import type { ZodError, ZodIssue } from "zod";
import { safeParseDocsJson } from "./docs-json.js";
import type { DocsJson } from "./docs-json.js";

/**
 * Human-readable rendering of docs.json validation failures.
 *
 * Raw Zod output is a JSON dump of `{ code, path, message }` objects — accurate
 * but hostile. This module turns each issue into a short block that names the
 * key (dotted path with `[i]` indices), states the reason in plain English,
 * shows the offending value, and — where we recognize the mistake — suggests a
 * fix. The goal: a docs author can find and correct the key without knowing Zod.
 */

export interface FormatDocsJsonErrorOptions {
  /** Raw docs.json text. Enables `(line N)` references and offending-value display. */
  raw?: string;
  /** File label for the header (e.g. "docs.json"). */
  file?: string;
  /** Force ANSI color on/off. Defaults to TTY auto-detection. */
  color?: boolean;
  /** Cap rendered issues; the rest are summarized as "… and N more". Default: 40. */
  limit?: number;
}

/** Validation error carrying the pretty message; `.message` is the rendered block. */
export class DocsJsonValidationError extends Error {
  readonly issues: ZodIssue[];
  constructor(error: ZodError, opts?: FormatDocsJsonErrorOptions) {
    super(formatDocsJsonError(error, opts));
    this.name = "DocsJsonValidationError";
    this.issues = error.issues ?? [];
  }
}

/** Parse + normalize, throwing a {@link DocsJsonValidationError} with a friendly message on failure. */
export function parseDocsJsonOrThrow(input: unknown, opts?: FormatDocsJsonErrorOptions): DocsJson {
  const result = safeParseDocsJson(input);
  if (result.success) return result.data;
  throw new DocsJsonValidationError(result.error, opts);
}

/**
 * Friendly rendering of a `JSON.parse` failure (malformed docs.json). Extracts
 * the error position when the engine reports one and points at the line/column
 * with a caret, instead of a bare "Unexpected token" dump.
 */
export function formatJsonSyntaxError(
  raw: string,
  err: unknown,
  opts: FormatDocsJsonErrorOptions = {},
): string {
  const useColor =
    opts.color ?? Boolean(typeof process !== "undefined" && process.stdout && process.stdout.isTTY);
  const c = useColor ? ansi : plain;
  const file = opts.file ?? "docs.json";
  const message = err instanceof Error ? err.message : String(err);

  const pos = jsonErrorPosition(message, raw);
  const out: string[] = [c.red(`✗ ${c.bold(file)} is not valid JSON`)];
  if (pos) {
    out.push(`  ${c.dim(`(line ${pos.line}, column ${pos.column})`)} ${message}`);
    const lineText = raw.split("\n")[pos.line - 1];
    if (lineText !== undefined) {
      out.push(`     ${c.dim(lineText.slice(0, 120))}`);
      out.push(`     ${c.red(`${" ".repeat(Math.max(0, pos.column - 1))}^`)}`);
    }
  } else {
    out.push(`  ${message}`);
  }
  out.push(c.green("  fix: check for a trailing comma, missing quote, or unclosed bracket"));
  return out.join("\n");
}

function jsonErrorPosition(message: string, raw: string): { line: number; column: number } | null {
  const lineCol = message.match(/line (\d+) column (\d+)/i);
  if (lineCol?.[1] && lineCol[2]) return { line: Number(lineCol[1]), column: Number(lineCol[2]) };
  const posMatch = message.match(/position (\d+)/i);
  if (posMatch?.[1]) {
    const offset = Number(posMatch[1]);
    const before = raw.slice(0, offset);
    const line = before.split("\n").length;
    const column = offset - before.lastIndexOf("\n");
    return { line, column };
  }
  return null;
}

// ── rendering ──────────────────────────────────────────────────────────────

const ansi = {
  red: (s: string) => `[31m${s}[39m`,
  green: (s: string) => `[32m${s}[39m`,
  yellow: (s: string) => `[33m${s}[39m`,
  cyan: (s: string) => `[36m${s}[39m`,
  bold: (s: string) => `[1m${s}[22m`,
  dim: (s: string) => `[2m${s}[22m`,
};
const plain = {
  red: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  cyan: (s: string) => s,
  bold: (s: string) => s,
  dim: (s: string) => s,
};

export function formatDocsJsonError(
  error: ZodError,
  opts: FormatDocsJsonErrorOptions = {},
): string {
  const useColor =
    opts.color ?? Boolean(typeof process !== "undefined" && process.stdout && process.stdout.isTTY);
  const c = useColor ? ansi : plain;
  const limit = opts.limit ?? 40;
  const file = opts.file ?? "docs.json";

  const data = opts.raw !== undefined ? tryParse(opts.raw) : undefined;
  const issues = dedupe(error.issues ?? []);
  const shown = issues.slice(0, limit);

  const out: string[] = [];
  const noun = issues.length === 1 ? "problem" : "problems";
  out.push(c.red(`✗ ${c.bold(file)} is not valid — ${issues.length} ${noun}`));

  shown.forEach((issue, i) => {
    const path = renderPath(issue.path);
    const line = opts.raw !== undefined ? locateLine(opts.raw, issue) : undefined;
    const lineRef = line ? c.dim(`  (line ${line})`) : "";
    out.push("");
    out.push(`  ${c.dim(`${i + 1}.`)} ${c.cyan(c.bold(path || "(root)"))}${lineRef}`);
    out.push(`     ${describe(issue, data, c)}`);
    const fix = suggest(issue, data);
    if (fix) out.push(`     ${c.green("fix:")} ${fix}`);
  });

  if (issues.length > shown.length) {
    out.push("");
    out.push(c.dim(`  … and ${issues.length - shown.length} more`));
  }
  return out.join("\n");
}

/** `["navigation","tabs",1,"groups",0,"pages"]` → `navigation.tabs[1].groups[0].pages`. */
function renderPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

type Colorize = typeof plain;

function describe(issue: ZodIssue, data: unknown, c: Colorize): string {
  const leaf = issue.path.length ? String(issue.path[issue.path.length - 1]) : "value";
  switch (issue.code) {
    case "invalid_type": {
      const expected = (issue as { expected?: string }).expected ?? "a different type";
      const value = data !== undefined ? valueAtPath(data, issue.path) : undefined;
      if (value === undefined) {
        return `missing required ${c.bold(`"${leaf}"`)} — expected ${c.yellow(expected)}`;
      }
      return `${c.bold(`"${leaf}"`)} must be ${c.yellow(expected)}, got ${describeValue(value)}`;
    }
    case "unrecognized_keys": {
      const keys = (issue as { keys?: string[] }).keys ?? [];
      const label = keys.length === 1 ? "unknown key" : "unknown keys";
      return `${label} ${keys.map((k) => c.bold(`"${k}"`)).join(", ")}`;
    }
    case "invalid_value": {
      const options = enumOptions(issue);
      const value = data !== undefined ? valueAtPath(data, issue.path) : undefined;
      const got = value !== undefined ? ` ${describeValue(value)}` : "";
      const allowed = options.length
        ? ` — allowed: ${options.map((o) => c.cyan(o)).join(", ")}`
        : "";
      return `invalid value${got}${allowed}`;
    }
    case "invalid_union": {
      // Union dumps every branch's errors; collapse to one line. If a branch
      // produced a single clear leaf error, surface that instead.
      const inner = firstLeafIssue(issue);
      if (inner && inner.code === "invalid_value") {
        const options = enumOptions(inner);
        const value = data !== undefined ? valueAtPath(data, issue.path) : undefined;
        const got = value !== undefined ? ` ${describeValue(value)}` : "";
        const allowed = options.length
          ? ` — allowed: ${options.map((o) => c.cyan(o)).join(", ")}`
          : "";
        return `invalid value${got}${allowed}`;
      }
      return `${c.bold(`"${leaf}"`)} doesn't match any accepted shape here`;
    }
    case "invalid_format": {
      const fmt = (issue as { format?: string }).format;
      if (fmt === "url") return `${c.bold(`"${leaf}"`)} must be a valid URL`;
      return `${c.bold(`"${leaf}"`)} is malformed${fmt ? ` (expected ${fmt})` : ""}`;
    }
    case "too_small":
    case "too_big": {
      return issue.message;
    }
    default:
      return issue.message;
  }
}

/** Curated fixes for the mistakes we recognize; falls back to enum did-you-mean. */
function suggest(issue: ZodIssue, data: unknown): string | null {
  const parent = issue.path.slice(0, -1).map(String).join(".");
  const leaf = issue.path.length ? String(issue.path[issue.path.length - 1]) : "";

  if (issue.code === "unrecognized_keys") {
    const keys = (issue as { keys?: string[] }).keys ?? [];
    const hints = keys.map((k) => KEY_RENAMES[k]).filter((h): h is string => Boolean(h));
    if (hints.length) return hints.join("; ");
    const one = keys.length === 1 ? `"${keys[0]}"` : "these keys";
    return `remove ${one} — not part of the docs.json schema (see https://tangly.dev/schema/docs.json)`;
  }

  // Enum mismatch — directly, or wrapped in a union (e.g. contextual.options
  // is `enum | object`, so the failure surfaces as invalid_union).
  const enumIssue =
    issue.code === "invalid_value"
      ? issue
      : issue.code === "invalid_union"
        ? firstLeafIssue(issue)
        : null;
  if (enumIssue) {
    const value = data !== undefined ? valueAtPath(data, issue.path) : undefined;
    const guess = didYouMean(value, enumOptions(enumIssue));
    if (guess) return `did you mean ${guess}?`;
  }

  if (issue.code === "invalid_type") {
    const value = data !== undefined ? valueAtPath(data, issue.path) : undefined;
    // Missing required `pages` on a nav group is the #1 migration snag.
    if (value === undefined && leaf === "pages" && /groups?\b|tabs?\b/.test(parent)) {
      return `add a "pages": [ … ] array, or attach an "openapi" spec to populate this group`;
    }
  }

  return null;
}

/** Known Mintlify → Tangly key renames, surfaced when the old key appears. */
const KEY_RENAMES: Record<string, string> = {
  display: 'use "mode" (Mintlify renamed api.playground.display → mode)',
  examples: 'use "codeSamples" under api (api.examples → api.codeSamples)',
};

function enumOptions(issue: ZodIssue): string[] {
  const raw =
    (issue as { values?: unknown[] }).values ?? (issue as { options?: unknown[] }).options ?? [];
  return raw.filter((v): v is string => typeof v === "string");
}

function didYouMean(value: unknown, options: string[]): string | null {
  if (typeof value !== "string" || !options.length) return null;
  let best: { v: string; d: number } | null = null;
  for (const o of options) {
    const d = levenshtein(value.toLowerCase(), o.toLowerCase());
    if (!best || d < best.d) best = { v: o, d };
  }
  return best && best.d <= 3 ? `"${best.v}"` : null;
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  if (typeof value === "string") return `"${truncate(value, 40)}"`;
  return String(value);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function valueAtPath(root: unknown, path: readonly PropertyKey[]): unknown {
  let node = root;
  for (const key of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<PropertyKey, unknown>)[key as PropertyKey];
  }
  return node;
}

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Drop exact (code+path) duplicates — union failures repeat the same leaf often. */
function dedupe(issues: ZodIssue[]): ZodIssue[] {
  const seen = new Set<string>();
  const out: ZodIssue[] = [];
  for (const i of issues) {
    const key = `${i.code}@${i.path.map(String).join(".")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  return out;
}

/** First nested leaf issue of a union error, if its structure exposes one. */
function firstLeafIssue(issue: ZodIssue): ZodIssue | null {
  const errors = (issue as { errors?: ZodIssue[][] }).errors;
  if (!Array.isArray(errors)) return null;
  for (const branch of errors) {
    if (Array.isArray(branch) && branch.length === 1 && branch[0]) return branch[0];
  }
  return null;
}

/**
 * Best-effort line of the offending key in the raw JSON text. Narrows the
 * search region segment-by-segment on object keys (numeric array indices are
 * skipped — they just keep the current cursor). For unrecognized keys, the
 * offending key lives one level below `path`, so we seek it explicitly.
 */
function locateLine(raw: string, issue: ZodIssue): number | null {
  let cursor = 0;
  for (const seg of issue.path) {
    if (typeof seg === "number") continue;
    const next = findKey(raw, String(seg), cursor);
    if (next === -1) break;
    cursor = next;
  }
  if (issue.code === "unrecognized_keys") {
    const bad = (issue as { keys?: string[] }).keys?.[0];
    if (bad) {
      const at = findKey(raw, bad, cursor);
      if (at !== -1) cursor = at;
    }
  }
  if (cursor === 0 && issue.path.length === 0) return null;
  return raw.slice(0, cursor).split("\n").length;
}

function findKey(raw: string, key: string, from: number): number {
  const needle = `"${key}"`;
  let idx = raw.indexOf(needle, from);
  while (idx !== -1) {
    // Confirm it's used as an object key (followed by optional ws then `:`).
    const after = raw.slice(idx + needle.length).match(/^\s*:/);
    if (after) return idx;
    idx = raw.indexOf(needle, idx + needle.length);
  }
  return -1;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a.charAt(i) === b.charAt(j) ? 0 : 1;
      curr.push(Math.min((curr[j] ?? 0) + 1, (prev[j + 1] ?? 0) + 1, (prev[j] ?? 0) + cost));
    }
    prev = curr;
  }
  return prev[b.length] ?? 0;
}
