import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Manifest } from "../manifest/types.js";

/**
 * Copy Mintlify-style static directories from the user's project root into
 * the build output. The dev server serves these via middleware; the build
 * needs them on disk.
 *
 * Cascade order (least → most specific; later entries clobber earlier):
 *   1. @tangly/theme-ui/public/<dir>
 *   2. @tangly/theme-<active>/public/<dir>
 *   3. <userRoot>/theme/public/<dir>
 *   4. <userRoot>/<dir>                      (Mintlify-style)
 *
 * `cp` with `force: true` overwrites, so copying in this order means the
 * user's project files always win over theme defaults.
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

function publicCascadeForBuild(userRoot: string, themeName: string | undefined): string[] {
  const here = new URL(".", import.meta.url).pathname;
  // dist/build-outputs/copy-assets.js → walk up to packages/.
  const packagesDir = resolve(here, "..", "..", "..");
  const active = themeName === "pith" ? "pith" : "tang";
  // Order matters: least-specific first so later cp() calls overwrite.
  return [
    resolve(packagesDir, "theme-ui", "public"),
    resolve(packagesDir, `theme-${active}`, "public"),
    resolve(userRoot, "theme", "public"),
    userRoot,
  ];
}

export async function copyStaticAssets(opts: CopyAssetsOptions): Promise<CopyAssetsResult> {
  const { manifest, outDir } = opts;
  const userRoot = manifest.root;
  const copied: string[] = [];
  const skipped: string[] = [];

  const roots = publicCascadeForBuild(userRoot, manifest.config.theme);

  for (const dir of STATIC_DIRS) {
    let copiedThis = false;
    for (const root of roots) {
      const src = resolve(root, dir);
      if (!existsSync(src)) continue;
      const dest = resolve(outDir, dir);
      // eslint-disable-next-line no-await-in-loop -- sequential cascade copy is intentional
      await cp(src, dest, { recursive: true, force: true });
      copiedThis = true;
    }
    if (copiedThis) copied.push(dir);
    else skipped.push(dir);
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
