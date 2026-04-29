import { existsSync } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "../manifest/types.js";

export interface RunPagefindOptions {
  manifest: Manifest;
  outDir: string;
}

export interface RunPagefindResult {
  /** Number of pages indexed (post-exclusion). */
  indexed: number;
  /** Slugs that were excluded (drafts + noindex). */
  excluded: string[];
  /** Path written, e.g. <outDir>/pagefind. */
  outputPath: string;
}

/**
 * Build a Pagefind index over `outDir`. Drafts and `noindex: true` pages
 * are filtered before the index is written so the static index never knows
 * about them. Mirrors the predicate used by sitemap.xml + llms.txt.
 *
 * Uses Pagefind's programmatic Node API rather than spawning the CLI —
 * keeps everything in-process and gives us structured exclusion control.
 */
export async function runPagefind(opts: RunPagefindOptions): Promise<RunPagefindResult> {
  const { manifest, outDir } = opts;

  // Compute slugs to exclude before touching the filesystem.
  const excluded: string[] = [];
  for (const [slug, page] of manifest.pages) {
    if (page.draft) excluded.push(slug);
    else if (page.frontmatter.noindex) excluded.push(slug);
  }

  // Pagefind expects a directory containing rendered HTML. Astro's static
  // build emits `dist/<slug>/index.html` for every route. We pre-delete
  // each excluded HTML file so Pagefind never sees it; cheaper than
  // post-filtering the index.
  for (const slug of excluded) {
    const file = join(outDir, slug, "index.html");
    if (existsSync(file)) {
      // eslint-disable-next-line no-await-in-loop -- per-file unlink is intentional
      await rm(file, { force: true });
    }
  }

  const outputPath = join(outDir, "pagefind");

  // Dynamic import keeps pagefind out of the dev/manifest hot path. We
  // only pay the load cost when actually building.
  type PagefindLib = {
    createIndex: (cfg?: { rootSelector?: string }) => Promise<{
      index: {
        addDirectory: (cfg: { path: string }) => Promise<unknown>;
        writeFiles: (cfg: { outputPath: string }) => Promise<unknown>;
      };
    }>;
  };
  const lib = (await import("pagefind")) as unknown as PagefindLib;

  const { index } = await lib.createIndex({
    rootSelector: "[data-pagefind-body]",
  });
  await index.addDirectory({ path: outDir });
  await index.writeFiles({ outputPath });

  // Sanity: confirm the index landed.
  let indexed = 0;
  if (existsSync(outputPath)) {
    try {
      const s = await stat(join(outputPath, "pagefind.js"));
      if (s.isFile()) indexed = manifest.pages.size - excluded.length;
    } catch {
      // pagefind may have laid down differently; counts are best-effort.
    }
  }

  return { indexed, excluded, outputPath };
}
