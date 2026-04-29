/**
 * Glossary loader.
 *
 * Authors define terms in either:
 *
 *   - `<root>/glossary.mdx` (single-file form): each `## H2` heading is a
 *     term; the body until the next H2 is the definition. The slug is the
 *     github-slugger slug of the heading text.
 *
 *   - `<root>/glossary/*.mdx` (per-term form): each file is one term.
 *     Frontmatter:
 *       term: "Capacity factor"
 *       aliases: ["CF", "load factor"]
 *     The slug is the filename without extension.
 *
 * If both forms exist, single-file form wins and a warning is logged.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import GithubSlugger from "github-slugger";
import matter from "gray-matter";

export interface GlossaryEntry {
  /** Canonical term text (used for matching). */
  term: string;
  /** Alternate spellings / abbreviations. */
  aliases: string[];
  /** Anchor slug on the glossary page (or filename slug for per-term form). */
  slug: string;
  /**
   * Resolved link href. `/glossary#<slug>` for the single-file form;
   * `/glossary/<slug>` for the per-term-file form.
   */
  href: string;
  /** Plain-text excerpt (first paragraph, max 200 chars). */
  definition: string;
}

const MAX_DEF_LEN = 200;

export function loadGlossary(root: string): GlossaryEntry[] {
  const absRoot = resolve(root);
  const singleFile = join(absRoot, "glossary.mdx");
  const dir = join(absRoot, "glossary");

  const hasSingle = fileExists(singleFile);
  const hasDir = dirExists(dir);

  if (hasSingle && hasDir) {
    console.warn(
      `[tangly] Both \`glossary.mdx\` and \`glossary/\` exist at ${absRoot}; ` +
        "preferring single-file form. Remove one to silence this warning.",
    );
    return loadSingleFile(singleFile);
  }
  if (hasSingle) return loadSingleFile(singleFile);
  if (hasDir) return loadGlossaryDir(dir);
  return [];
}

function fileExists(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function dirExists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Parse `glossary.mdx`. Each `## term` heading starts an entry; everything
 * until the next H2 (or EOF) is the body.
 */
function loadSingleFile(file: string): GlossaryEntry[] {
  const raw = readFileSync(file, "utf8");
  const { content } = matter(raw);

  const slugger = new GithubSlugger();
  const entries: GlossaryEntry[] = [];

  const lines = content.split("\n");
  let current: { term: string; bodyLines: string[] } | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m && m[1]) {
      if (current) entries.push(finalize(current, slugger));
      const headingText = stripInlineMarkdown(m[1]);
      current = { term: headingText, bodyLines: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }
  if (current) entries.push(finalize(current, slugger));

  return entries;
}

function finalize(
  section: { term: string; bodyLines: string[] },
  slugger: GithubSlugger,
): GlossaryEntry {
  const slug = slugger.slug(section.term);
  // Honour aliases via either a leading "**Aliases:** a, b" line OR an
  // inline "(aka X, Y)" pattern in the body. Both are common conventions.
  const body = section.bodyLines.join("\n").trim();
  const aliases = extractAliases(body);
  const definition = excerpt(body);
  return {
    term: section.term,
    aliases,
    slug,
    href: `/glossary#${slug}`,
    definition,
  };
}

const ALIASES_LINE_RE = /^\s*(?:\*\*)?aliases?:?(?:\*\*)?\s*([^\n]+)$/im;
const AKA_RE = /\(\s*(?:aka|a\.k\.a\.|also known as)\s+([^)]+)\)/i;

function extractAliases(body: string): string[] {
  const out: string[] = [];
  const lineMatch = ALIASES_LINE_RE.exec(body);
  if (lineMatch?.[1]) {
    for (const a of splitList(lineMatch[1])) out.push(a);
  }
  const akaMatch = AKA_RE.exec(body);
  if (akaMatch?.[1]) {
    for (const a of splitList(akaMatch[1])) out.push(a);
  }
  return dedupe(out);
}

function splitList(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim().replace(/^["'`]|["'`]$/g, ""))
    .filter(Boolean);
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const key = x.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }
  return out;
}

/**
 * Per-term form. Each `glossary/<slug>.mdx` has frontmatter:
 *   term: <required>
 *   aliases?: string[]
 * Slug is the filename (without extension).
 */
function loadGlossaryDir(dir: string): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return entries;
  }
  for (const name of names) {
    if (!name.endsWith(".mdx") && !name.endsWith(".md")) continue;
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const full = join(dir, name);
    const raw = readFileSync(full, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as { term?: unknown; aliases?: unknown };
    const term = typeof fm.term === "string" ? fm.term.trim() : "";
    if (!term) {
      console.warn(
        `[tangly] glossary entry ${full} has no \`term\` frontmatter; skipping.`,
      );
      continue;
    }
    const aliases = Array.isArray(fm.aliases)
      ? fm.aliases.filter((x): x is string => typeof x === "string")
      : [];
    const slug = name.replace(/\.(mdx|md)$/, "");
    entries.push({
      term,
      aliases: dedupe(aliases),
      slug,
      href: `/glossary/${slug}`,
      definition: excerpt(parsed.content),
    });
  }
  return entries;
}

/**
 * Plain-text excerpt of the first non-empty paragraph, trimmed to MAX_DEF_LEN.
 */
function excerpt(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const para = trimmed.split(/\n\s*\n/, 1)[0] ?? "";
  const plain = stripInlineMarkdown(para).replace(/\s+/g, " ").trim();
  if (plain.length <= MAX_DEF_LEN) return plain;
  return `${plain.slice(0, MAX_DEF_LEN - 1).trimEnd()}…`;
}

/**
 * Strip the most common inline markdown markers so tooltips read cleanly.
 */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "$1");
}
