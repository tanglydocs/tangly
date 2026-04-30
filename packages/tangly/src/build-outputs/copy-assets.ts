import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import pc from "picocolors";
import { buildPublicCascade } from "../plugin/theme-resolver.js";
import type { Manifest } from "../manifest/types.js";
import { buildIgnoreMatcher, type IgnoreMatcher } from "./ignore-matcher.js";

/**
 * Copy static assets into the build output.
 *
 * The cascade (least → most specific; later writes overwrite earlier):
 *   4. <theme-ui>/public/                  shared baseline
 *   3. <activeTheme>/public/               theme-tang/pith/pip bundled assets
 *   2. <userRoot>/theme/public/            project's per-theme override
 *   1. <userRoot>/**                       everything not ignored by the
 *                                          three-layer ignore stack (baseline
 *                                          + .gitignore + .tanglyignore)
 *
 * Tier 1 used to be limited to a hardcoded STATIC_DIRS allowlist. It now
 * walks userRoot recursively gated by the IgnoreMatcher, so any file the
 * user drops at the root (CNAME, _redirects, _headers, robots.txt overrides,
 * .well-known/, custom favicons, etc.) ships verbatim into dist/ — same
 * convention as Docker, Vercel, etc.
 *
 * `astroEmitted` is the set of relative paths Astro just emitted into outDir.
 * Tier 1 hard-rejects anything in the reserved `_astro/` namespace (those are
 * load-bearing hashed bundles), and warns + allows for non-`_astro/` paths
 * that collide with an emitted file (placement is opt-in by the user).
 */

export interface CopyAssetsOptions {
  manifest: Manifest;
  outDir: string;
  /** Paths (POSIX, relative to outDir) Astro just emitted. Hard-protected. */
  astroEmitted?: ReadonlySet<string>;
}

export interface CopyAssetsResult {
  copied: string[];
  skipped: string[];
}

export async function copyStaticAssets(opts: CopyAssetsOptions): Promise<CopyAssetsResult> {
  const { manifest, outDir, astroEmitted = new Set<string>() } = opts;
  const userRoot = manifest.root;
  const copied: string[] = [];
  const skipped: string[] = [];

  // Tier 4 → Tier 2 (theme cascade). Copy whole `public/` root for each,
  // but refuse any source that contains an `_astro/` namespace path —
  // those would clobber Astro's hashed output once cp() merges the tree.
  const cascade = buildPublicCascade(userRoot, manifest.config.theme);
  // eslint-disable-next-line unicorn/no-array-reverse -- ts target ES2022; toReversed unavailable
  for (const root of cascade.slice(1).reverse()) {
    // eslint-disable-next-line no-await-in-loop -- sequential check
    await assertNoAstroNamespace(root);
    // eslint-disable-next-line no-await-in-loop -- sequential overwrite is intentional
    await cp(root, outDir, { recursive: true, force: true });
    copied.push(relative(userRoot, root) || root);
  }

  // Tier 1: walk userRoot, copy everything not ignored.
  const matcher = buildIgnoreMatcher({ userRoot });
  const tier1Copied: string[] = [];
  await copyTier1({
    userRoot,
    outDir,
    matcher,
    astroEmitted,
    copied: tier1Copied,
  });
  if (tier1Copied.length > 0) {
    copied.push(`${tier1Copied.length} root file(s) [${matcher.sources.join(" + ")}]`);
  } else {
    skipped.push("root passthrough (nothing to copy)");
  }

  // Favicon may live at an arbitrary path within userRoot — Tier 1 already
  // copies it via the walk if it's not ignored. Keep an explicit fallback for
  // the rare case where someone gitignores it but still wants it shipped.
  const fav = manifest.config.favicon;
  const favPath = typeof fav === "string" ? fav : (fav?.light ?? fav?.dark);
  if (favPath) {
    const cleaned = favPath.replace(/^\/+/, "");
    const src = resolve(userRoot, cleaned);
    const rel = relative(userRoot, src);
    const dest = resolve(outDir, cleaned);
    if (!rel.startsWith("..") && !isAbsolute(rel) && existsSync(src) && !existsSync(dest)) {
      await mkdir(dirname(dest), { recursive: true });
      await cp(src, dest);
      copied.push(`favicon (${cleaned})`);
    }
  }

  return { copied, skipped };
}

async function copyTier1(args: {
  userRoot: string;
  outDir: string;
  matcher: IgnoreMatcher;
  astroEmitted: ReadonlySet<string>;
  copied: string[];
}): Promise<void> {
  const { userRoot, outDir, matcher, astroEmitted, copied } = args;
  const stack: string[] = [userRoot];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    // eslint-disable-next-line no-await-in-loop -- depth-first walk
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = relative(userRoot, abs).split(sep).join("/");
      if (!rel) continue;

      if (entry.isDirectory()) {
        // Apply ignore matcher to directories with a trailing slash so
        // gitignore-style `dist/` patterns prune the recursion.
        if (matcher.ignores(`${rel}/`)) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (matcher.ignores(rel)) continue;

      // Hard-protect: refuse anything in Astro's reserved `_astro/` namespace,
      // regardless of whether this specific filename matched something Astro
      // emitted this build. The namespace is reserved as a whole.
      if (rel === "_astro" || rel.startsWith("_astro/")) {
        throw new Error(
          `[tangly] Refusing to copy into Astro's reserved namespace: ${rel}\n` +
            `  /_astro/ is reserved for Astro's hashed output. Move your file elsewhere.`,
        );
      }

      // Soft collision: user file lands at the same path as a non-_astro
      // emitted file (e.g. user CNAME alongside emitted /robots.txt, or
      // user 404.html shadowing the rendered one). Warn but let the user
      // file win — placement is opt-in.
      if (astroEmitted.has(rel)) {
        console.warn(
          pc.yellow(
            `[tangly] ⚠ User file ${rel} overwrites a generated output. Remove one to silence this warning.`,
          ),
        );
      }

      // Best-effort warn for sibling page collisions: a copied non-HTML file
      // sitting next to a rendered page may indicate an unintended layout.
      const siblingHtml = `${rel.replace(/\.[^/.]+$/, "")}/index.html`;
      if (!rel.endsWith(".html") && !astroEmitted.has(rel) && astroEmitted.has(siblingHtml)) {
        console.warn(
          pc.yellow(
            `[tangly] ⚠ User file ${rel} sits next to a rendered page — make sure that's intentional.`,
          ),
        );
      }

      const dest = join(outDir, rel);
      // eslint-disable-next-line no-await-in-loop -- sequential is fine for typical doc projects
      await mkdir(dirname(dest), { recursive: true });
      // eslint-disable-next-line no-await-in-loop
      await cp(abs, dest, { force: true });
      copied.push(rel);
    }
  }
}

/**
 * Walk a theme/public root and throw if any path lives under `_astro/`.
 * Theme authors should never ship into Astro's reserved namespace; if they
 * do, `cp(root, outDir)` would silently merge that subtree on top of the
 * hashed bundles and corrupt the build.
 */
async function assertNoAstroNamespace(root: string): Promise<void> {
  if (!existsSync(root)) return;
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    // eslint-disable-next-line no-await-in-loop
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = relative(root, abs).split(sep).join("/");
      if (rel === "_astro" || rel.startsWith("_astro/")) {
        throw new Error(
          `[tangly] Theme/public source contains an _astro/ path: ${rel}\n` +
            `  Source: ${root}\n` +
            `  /_astro/ is reserved for Astro's hashed output. Move the file elsewhere in the theme.`,
        );
      }
      if (entry.isDirectory()) stack.push(abs);
    }
  }
}

/** Re-exported for tests + dev middleware reuse. */
export { buildIgnoreMatcher } from "./ignore-matcher.js";
export type { IgnoreMatcher } from "./ignore-matcher.js";
