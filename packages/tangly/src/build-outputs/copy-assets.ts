import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Manifest } from "../manifest/types.js";

/**
 * Copy Mintlify-style static directories from the user's project root into
 * the build output. The dev server serves these via middleware; the build
 * needs them on disk.
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
