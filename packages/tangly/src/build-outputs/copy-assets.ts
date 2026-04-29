import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { buildPublicCascade } from "../plugin/theme-resolver.js";
import type { Manifest } from "../manifest/types.js";

/**
 * Copy static assets from the public-folder cascade into the build output.
 *
 * The cascade (most → least specific):
 *   1. <userRoot>/<dir>                  project's /images, /logo, etc.
 *   2. <userRoot>/theme/public/...       project's per-theme override
 *   3. <activeTheme>/public/...          theme-tang/pith/pip bundled assets
 *   4. <theme-ui>/public/...             shared baseline
 *
 * For tier 1 we copy only the canonical static-dir names because
 * <userRoot> itself contains source files that don't belong in the build.
 * For tiers 2-4 we copy each cascade root in full since they're explicit
 * public directories.
 *
 * Copy order is least → most specific so `cp(... { force: true })`
 * overwrites, leaving the user's files on top.
 */
const STATIC_DIRS = ["images", "logo", "public", "static", "assets"] as const;

export interface CopyAssetsOptions {
  manifest: Manifest;
  outDir: string;
}

export interface CopyAssetsResult {
  copied: string[];
  skipped: string[];
}

export async function copyStaticAssets(opts: CopyAssetsOptions): Promise<CopyAssetsResult> {
  const { manifest, outDir } = opts;
  const userRoot = manifest.root;
  const copied: string[] = [];
  const skipped: string[] = [];

  // Most → least specific. `cascade[0]` is always userRoot (tier 1).
  const cascade = buildPublicCascade(userRoot, manifest.config.theme);

  // Reverse so we copy least-specific first; later cp() calls overwrite.
  // Copy entire contents of each theme/public root (tiers 2-4).
  // eslint-disable-next-line unicorn/no-array-reverse -- ts target is ES2022; toReversed isn't available
  for (const root of cascade.slice(1).reverse()) {
    // eslint-disable-next-line no-await-in-loop -- sequential overwrite is intentional
    await cp(root, outDir, { recursive: true, force: true });
    copied.push(relative(userRoot, root) || root);
  }

  // Tier 1: <userRoot> — copy only the canonical static-dir names.
  for (const dir of STATIC_DIRS) {
    const src = resolve(userRoot, dir);
    if (!existsSync(src)) {
      skipped.push(dir);
      continue;
    }
    const dest = resolve(outDir, dir);
    // eslint-disable-next-line no-await-in-loop -- sequential dir copy is intentional
    await cp(src, dest, { recursive: true, force: true });
    copied.push(dir);
  }

  // Favicon may live anywhere — copy if it's inside userRoot and not under
  // a directory we already copied above.
  const fav = manifest.config.favicon;
  const favPath = typeof fav === "string" ? fav : (fav?.light ?? fav?.dark);
  if (favPath) {
    const cleaned = favPath.replace(/^\/+/, "");
    const src = resolve(userRoot, cleaned);
    const rel = relative(userRoot, src);
    if (!rel.startsWith("..") && !isAbsolute(rel) && existsSync(src)) {
      const top = rel.split("/")[0]!;
      if (!STATIC_DIRS.includes(top as (typeof STATIC_DIRS)[number])) {
        const dest = resolve(outDir, cleaned);
        await mkdir(dirname(dest), { recursive: true });
        await cp(src, dest);
        copied.push(`favicon (${cleaned})`);
      }
    }
  }

  return { copied, skipped };
}
