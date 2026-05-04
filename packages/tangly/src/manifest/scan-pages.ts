import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { type Frontmatter, safeParseFrontmatter } from "@tanglydocs/schema";
import matter from "gray-matter";
import type { ZodError } from "zod";
import { computeReadingTime, loadGitMeta } from "./git-meta.js";

const MD_JSX_RE = /<[A-Z][A-Za-z0-9]*[\s/>]/;

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".astro", ".tangly", ".next"]);

// These directories are only skipped at the user-root level. Deeper
// `components/` or `templates/` directories are legitimate doc paths
// (e.g. `reference/components/callouts.mdx`).
const SKIP_DIRS_AT_ROOT = new Set([
  "components",
  "templates",
  "public",
  "static",
  "assets",
  "snippets",
]);

export interface PageOnDisk {
  /** Slug — relative path without extension, forward slashes. */
  slug: string;
  /** Absolute path to the .mdx or .md file. */
  file: string;
  /** Source extension (mdx | md). */
  ext: "mdx" | "md";
  /** Parsed frontmatter (or null on error). */
  frontmatter: Frontmatter | null;
  /** Raw frontmatter parse error message. */
  frontmatterError?: string;
  /** Underlying Zod error, when available — used for pretty-printing. */
  frontmatterZodError?: ZodError;
  /** Body content (without frontmatter). */
  content: string;
  /** ISO timestamp from git log (most recent commit touching this file). */
  lastUpdated?: string;
  /** Estimated reading time in minutes. */
  readingTime?: number;
}

export async function scanPages(root: string): Promise<PageOnDisk[]> {
  const pages: PageOnDisk[] = [];
  await walk(root, root, pages);

  // Decorate with git meta + reading time. Git lookups key off paths
  // relative to the repo root (not the docs root) so monorepos work.
  const { meta: gitMeta, repoRoot } = loadGitMeta({ root });
  const lookupBase = repoRoot ?? root;
  for (const p of pages) {
    const rel = relative(lookupBase, p.file).split(sep).join("/");
    const m = gitMeta.get(rel);
    if (m?.lastUpdated) p.lastUpdated = m.lastUpdated;
    p.readingTime = computeReadingTime(p.content);
  }
  return pages;
}

async function walk(root: string, dir: string, out: PageOnDisk[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return;
  }
  const atRoot = dir === root;
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (atRoot && SKIP_DIRS_AT_ROOT.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- recursive walk needs to await each subdir
      await walk(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const isMdx = entry.name.endsWith(".mdx");
    const isMd = !isMdx && entry.name.endsWith(".md");
    if (!isMdx && !isMd) continue;
    // skip files starting with `_` (snippets, _section.mdx, etc.)
    if (entry.name.startsWith("_")) continue;
    // README files are reserved for the project root, not docs pages.
    if (entry.name.toLowerCase() === "readme.md") continue;

    const slug = relative(root, full)
      .replace(/\.(mdx|md)$/, "")
      .split(sep)
      .join("/")
      .replace(/\/index$/, "");

    const raw = readFileSync(full, "utf8");
    const parsed = matter(raw);
    const fm = safeParseFrontmatter(parsed.data);

    let frontmatterError = fm.success ? undefined : fm.error.message;
    const frontmatterZodError = fm.success ? undefined : fm.error;

    // Plain `.md` files are rendered as Markdown only — JSX components
    // would be parsed as text. Catch the common case (`<UpperCaseTag>`)
    // and surface a clear error pointing the author to rename.
    if (isMd && MD_JSX_RE.test(parsed.content)) {
      frontmatterError = ".md file contains JSX — rename to .mdx to use components";
    }

    out.push({
      slug,
      file: full,
      ext: isMdx ? "mdx" : "md",
      frontmatter: fm.success ? fm.data : null,
      ...(frontmatterError ? { frontmatterError } : {}),
      ...(frontmatterZodError ? { frontmatterZodError } : {}),
      content: parsed.content,
    });
  }
}

export function readPageFrontmatter(file: string): {
  frontmatter: Frontmatter | null;
  error?: string;
} {
  try {
    statSync(file);
  } catch {
    return { frontmatter: null, error: "file not found" };
  }
  const raw = readFileSync(file, "utf8");
  const parsed = matter(raw);
  const fm = safeParseFrontmatter(parsed.data);
  if (!fm.success) {
    return { frontmatter: null, error: fm.error.message };
  }
  return { frontmatter: fm.data };
}
