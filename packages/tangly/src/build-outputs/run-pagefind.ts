import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { safeParseFrontmatter } from "@tangly/schema";
import matter from "gray-matter";
import type { Manifest } from "../manifest/types.js";

export interface RunPagefindOptions {
  manifest: Manifest;
  outDir: string;
  /**
   * Project root used to discover orphan/draft-inclusive pages that are NOT
   * in `manifest.pages` (which is filtered by nav membership and by the
   * draft predicate). Defaults to `manifest.root`.
   */
  userRoot?: string;
}

export interface RunPagefindResult {
  /** Number of HTML files fed into the index. */
  indexed: number;
  /** Slugs whose emitted HTML was kept on disk but excluded from the index. */
  excluded: string[];
  /** Path written, e.g. <outDir>/pagefind. */
  outputPath: string;
}

/**
 * Build a Pagefind index over `outDir`. Drafts and `noindex: true` pages
 * are excluded from the index — but they remain on disk and are still
 * routable.
 *
 * The exclusion set is computed from the union of:
 *   1. `manifest.pages`           — nav-referenced pages with frontmatter
 *   2. on-disk MDX files          — covers orphans + draft-inclusive builds
 *      (frontmatter is re-read so this matches what the runtime actually
 *      shipped, not just what was in the nav).
 *
 * Pagefind's Node API receives only the included HTML files via
 * `addHTMLFile`, so we never mutate `outDir`.
 */
export async function runPagefind(opts: RunPagefindOptions): Promise<RunPagefindResult> {
  const { manifest, outDir } = opts;
  const userRoot = opts.userRoot ?? manifest.root;
  const outputPath = join(outDir, "pagefind");

  const excludedSet = new Set<string>();

  // 1. From the manifest (nav pages).
  for (const [slug, page] of manifest.pages) {
    if (page.draft || page.frontmatter.noindex) excludedSet.add(slug);
  }

  // 2. From on-disk MDX. Catches orphans + every page that exists in the
  // emitted output regardless of nav membership. Re-parsing frontmatter is
  // cheap relative to the build cost and keeps this independent of any
  // earlier filtering.
  if (userRoot && existsSync(userRoot)) {
    const mdxFiles = await collectMdx(userRoot);
    for (const file of mdxFiles) {
      try {
        const raw = readFileSync(file, "utf8");
        const fm = safeParseFrontmatter(matter(raw).data);
        if (!fm.success) continue;
        const slug = relative(userRoot, file)
          .replace(/\.(mdx|md)$/, "")
          .split(sep)
          .join("/");
        if (fm.data.draft || fm.data.noindex) excludedSet.add(slug);
      } catch {
        // ignore individual file errors
      }
    }
  }

  // Walk every emitted index.html and either include or skip it.
  const htmlFiles = await collectHtml(outDir, outputPath);

  type PagefindLib = {
    createIndex: (cfg?: { rootSelector?: string }) => Promise<{
      index: {
        addHTMLFile: (cfg: { url: string; content: string }) => Promise<unknown>;
        writeFiles: (cfg: { outputPath: string }) => Promise<unknown>;
      };
    }>;
  };
  const lib = (await import("pagefind")) as unknown as PagefindLib;
  const { index } = await lib.createIndex({
    rootSelector: "[data-pagefind-body]",
  });

  let indexed = 0;
  const excluded: string[] = [];
  for (const file of htmlFiles) {
    // Slug is the directory path containing index.html, relative to outDir.
    const dir = relative(outDir, file).replace(/\/index\.html$/, "");
    if (dir === "" || dir === "index.html") continue; // root index page
    const slug = dir.split(sep).join("/");

    if (excludedSet.has(slug)) {
      excluded.push(slug);
      continue;
    }

    const content = readFileSync(file, "utf8");
    // URL passed to Pagefind controls click destinations in result UI.
    // eslint-disable-next-line no-await-in-loop -- one-by-one is intentional
    await index.addHTMLFile({ url: `/${slug}`, content });
    indexed += 1;
  }

  await index.writeFiles({ outputPath });

  return { indexed, excluded, outputPath };
}

async function collectMdx(root: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- recursive walk
      await collectMdx(full, out);
    } else if (entry.isFile() && /\.(mdx|md)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function collectHtml(outDir: string, skipDir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(outDir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(outDir, entry.name);
    if (full === skipDir) continue; // don't index our own pagefind output
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- recursive walk
      await collectHtml(full, skipDir, out);
    } else if (entry.isFile() && entry.name === "index.html") {
      out.push(full);
    }
  }
  return out;
}
