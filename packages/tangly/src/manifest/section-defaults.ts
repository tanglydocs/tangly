import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { Frontmatter } from "@tanglydocs/schema";
import { safeParseFrontmatter } from "@tanglydocs/schema";
import matter from "gray-matter";

/**
 * Inheritable frontmatter fields that cascade from `_section.mdx` /
 * `_meta.json` down to descendant pages.
 */
const INHERITABLE_KEYS = ["template", "mode", "tag", "noindex", "seo", "aiContext"] as const;

type InheritableKey = (typeof INHERITABLE_KEYS)[number];

interface SectionDefaults {
  /** Defaults the section provides. */
  values: Partial<Frontmatter>;
  /** Directory the defaults apply to. */
  dir: string;
}

/**
 * Walk a page's directory and ancestor directories (up to project root),
 * collect any `_section.mdx` or `_meta.json`, and produce the merged
 * inheritable defaults.
 *
 * Closer-to-page values win: e.g., `guides/_section.mdx` overrides
 * `_section.mdx` at the root.
 */
export function resolveSectionDefaults(
  pageFile: string,
  projectRoot: string,
): Partial<Frontmatter> {
  const root = resolve(projectRoot);
  const sections: SectionDefaults[] = [];

  let dir = dirname(resolve(pageFile));
  while (true) {
    const fromSection = readSectionMdx(dir);
    if (fromSection) sections.push({ values: fromSection, dir });
    const fromMeta = readMetaJson(dir);
    if (fromMeta) sections.push({ values: fromMeta, dir });

    if (dir === root) break;
    const parent = dirname(dir);
    if (parent === dir) break; // root of filesystem
    if (!isInside(parent, root)) break;
    dir = parent;
  }

  // Walk from outermost (root) to innermost so closer wins.
  sections.reverse();

  const merged: Partial<Frontmatter> = {};
  for (const s of sections) {
    for (const key of INHERITABLE_KEYS) {
      const v = (s.values as Record<string, unknown>)[key];
      if (v !== undefined) (merged as Record<string, unknown>)[key] = v;
    }
  }
  return merged;
}

function readSectionMdx(dir: string): Partial<Frontmatter> | null {
  const path = resolve(dir, "_section.mdx");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = matter(raw);
    const fm = safeParseFrontmatter(parsed.data);
    return fm.success ? fm.data : null;
  } catch {
    return null;
  }
}

function readMetaJson(dir: string): Partial<Frontmatter> | null {
  const path = resolve(dir, "_meta.json");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const fm = safeParseFrontmatter(data);
    return fm.success ? fm.data : null;
  } catch {
    return null;
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel.length === 0 || (!rel.startsWith("..") && !rel.split(sep).includes(".."));
}

export { INHERITABLE_KEYS };
export type { InheritableKey };
