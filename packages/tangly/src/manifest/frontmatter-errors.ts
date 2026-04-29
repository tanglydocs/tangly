import { readFileSync } from "node:fs";
import type { ZodError, ZodIssue } from "zod";

/**
 * Render a Zod frontmatter error as a human-readable, multi-line message
 * with file path, approximate line number for the offending field, the
 * expected schema, and a suggested fix.
 *
 * Caller passes the absolute file path so we can read the raw text and
 * locate the field's line via a simple grep — exact column resolution
 * isn't worth the YAML parsing cost for a tiny terminal hint.
 */
export function formatFrontmatterError(opts: {
  file: string;
  error: ZodError;
}): string {
  const issues = opts.error.issues ?? [];
  const lines: string[] = [];
  const raw = readFileMaybe(opts.file);

  for (const issue of issues) {
    const fieldPath = issue.path.map(String).join(".");
    const line = raw ? findFieldLine(raw, fieldPath) : null;
    const where = line ? `${opts.file}:${line}` : opts.file;
    lines.push(`✗ ${where}`);
    lines.push(`    field "${fieldPath || "(root)"}" — ${describeIssue(issue)}`);
    const suggestion = suggest(issue);
    if (suggestion) lines.push(`    suggestion: ${suggestion}`);
  }
  return lines.join("\n");
}

function readFileMaybe(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * Find the YAML line where a top-level field appears. Frontmatter is the
 * leading `---\n…\n---` block; we only scan up to the closing fence.
 */
function findFieldLine(raw: string, fieldPath: string): number | null {
  if (!fieldPath) return null;
  const top = fieldPath.split(".")[0];
  if (!top) return null;
  const lines = raw.split("\n");
  let inFm = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") {
      if (!inFm) {
        inFm = true;
        continue;
      }
      break;
    }
    if (!inFm) continue;
    const re = new RegExp(`^\\s*${escapeRe(top)}\\s*:`);
    if (re.test(line)) return i + 1;
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function describeIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type": {
      const got = (issue as unknown as { received?: unknown }).received ?? "undefined";
      return `expected ${issue.expected}, got ${String(got)}`;
    }
    case "invalid_value": {
      const opts = (issue as unknown as { values?: unknown[] }).values;
      if (Array.isArray(opts) && opts.length) {
        return `expected one of: ${opts.map((o) => JSON.stringify(o)).join(" | ")}`;
      }
      return issue.message;
    }
    case "unrecognized_keys": {
      const keys = (issue as unknown as { keys?: string[] }).keys ?? [];
      return `unknown key${keys.length === 1 ? "" : "s"}: ${keys.join(", ")}`;
    }
    default:
      return issue.message;
  }
}

function suggest(issue: ZodIssue): string | null {
  if (issue.code === "invalid_value") {
    const got = String(
      (issue as unknown as { received?: unknown }).received ?? "",
    ).toLowerCase();
    const opts = (issue as unknown as { values?: unknown[] }).values ?? [];
    let best: { v: string; d: number } | null = null;
    for (const o of opts) {
      if (typeof o !== "string") continue;
      const d = levenshtein(got, o.toLowerCase());
      if (!best || d < best.d) best = { v: o, d };
    }
    if (best && best.d <= 3) return `did you mean "${best.v}"?`;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0: number[] = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1: number[] = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a.charAt(i) === b.charAt(j) ? 0 : 1;
      v1[j + 1] = Math.min((v1[j] ?? 0) + 1, (v0[j + 1] ?? 0) + 1, (v0[j] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j] ?? 0;
  }
  return v1[b.length] ?? 0;
}
