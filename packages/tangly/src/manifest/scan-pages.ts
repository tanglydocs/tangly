import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { type Frontmatter, safeParseFrontmatter } from "@tangly/schema";
import matter from "gray-matter";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".astro",
  ".tangly",
  ".next",
  "components",
  "templates",
  "public",
]);

export interface PageOnDisk {
  /** Slug — relative path without extension, forward slashes. */
  slug: string;
  /** Absolute path to the .mdx file. */
  file: string;
  /** Parsed frontmatter (or null on error). */
  frontmatter: Frontmatter | null;
  /** Raw frontmatter parse error message. */
  frontmatterError?: string;
  /** Body content (without frontmatter). */
  content: string;
}

export async function scanPages(root: string): Promise<PageOnDisk[]> {
  const pages: PageOnDisk[] = [];
  await walk(root, root, pages);
  return pages;
}

async function walk(root: string, dir: string, out: PageOnDisk[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- recursive walk needs to await each subdir
      await walk(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".mdx")) continue;
    // skip files starting with `_` (snippets, _section.mdx, etc.)
    if (entry.name.startsWith("_")) continue;

    const slug = relative(root, full)
      .replace(/\.mdx$/, "")
      .split(sep)
      .join("/");

    const raw = readFileSync(full, "utf8");
    const parsed = matter(raw);
    const fm = safeParseFrontmatter(parsed.data);

    out.push({
      slug,
      file: full,
      frontmatter: fm.success ? fm.data : null,
      frontmatterError: fm.success ? undefined : fm.error.message,
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
