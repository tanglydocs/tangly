import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand } from "citty";
import pc from "picocolors";
import { buildBuildReport, writeBuildReport } from "../../build-outputs/build-report.js";
import { copyStaticAssets } from "../../build-outputs/copy-assets.js";
import { writeBuildOutputs } from "../../build-outputs/index.js";
import { runPagefind } from "../../build-outputs/run-pagefind.js";
import { reportConfigError } from "../../manifest/config-error.js";
import { buildManifest } from "../../manifest/index.js";
import { resolveSite } from "../../site/resolve-site.js";
import { loadDotenv } from "../load-env.js";
import { getRuntimeDir } from "../runtime-paths.js";

export const buildCommand = defineCommand({
  meta: {
    name: "build",
    description: "Production build",
  },
  args: {
    out: {
      type: "string",
      description: "Output directory (default ./dist)",
      default: "./dist",
    },
    adapter: {
      type: "string",
      description: "Deploy adapter: vercel | cloudflare | node | static (auto-detect)",
    },
    config: {
      type: "string",
      description: "Path to docs.json (relative to root)",
      default: "docs.json",
    },
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
    base: {
      type: "string",
      description: "Deploy under subpath like /docs",
      default: "/",
    },
    siteUrl: {
      type: "string",
      description:
        "Absolute deploy URL (overrides docs.json siteUrl). Sets canonical + og:image host.",
    },
    env: {
      type: "string",
      description:
        "Deploy environment: production | preview. Previews get robots:noindex + canonical->prod.",
    },
    analyze: {
      type: "boolean",
      description: "Write a build-size report to dist/_tangly/",
      default: false,
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const outDir = resolve(userRoot, args.out);

    loadDotenv(userRoot);

    const adapter = args.adapter ?? autoDetectAdapter(userRoot);
    const validAdapters = ["vercel", "cloudflare", "node", "static"] as const;
    if (!(validAdapters as readonly string[]).includes(adapter)) {
      console.error(
        pc.red(`✗ Unknown --adapter "${adapter}". Expected: ${validAdapters.join(" | ")}.`),
      );
      process.exit(1);
    }
    console.log(pc.cyan(`▲ Building Tangly project (${adapter})…`));
    if (adapter === "cloudflare" || adapter === "node") {
      console.log(
        pc.dim(
          `  Note: ${adapter} adapter is recognized but not yet applied — current builds are static. SSR support lands with the AI chat endpoint.`,
        ),
      );
    }

    process.env.TANGLY_USER_ROOT = userRoot;
    process.env.TANGLY_CONFIG_FILE = args.config;
    process.env.TANGLY_BASE = args.base;
    process.env.TANGLY_ADAPTER = adapter;
    // --site-url / --env override docs.json + platform detection for this build.
    if (args.env && args.env !== "production" && args.env !== "preview") {
      // Without this guard a typo (e.g. --env stagng) falls through to the
      // production default — no noindex — and silently lets a staging deploy
      // get indexed.
      console.error(pc.red(`✗ Unknown --env "${args.env}". Expected: production | preview.`));
      process.exit(1);
    }
    if (args.siteUrl) process.env.TANGLY_SITE_URL = args.siteUrl;
    if (args.env) process.env.TANGLY_ENV = args.env;

    // Validate first
    let manifest: Awaited<ReturnType<typeof buildManifest>>;
    try {
      manifest = await buildManifest({ root: userRoot, configFile: args.config });
    } catch (err) {
      if (reportConfigError(err)) process.exit(1);
      throw err;
    }
    console.log(pc.dim(`  ${manifest.pages.size} pages, ${manifest.warnings.length} warnings`));

    const runtimeDir = getRuntimeDir();

    // Astro emits prerender chunks (`<outDir>/.prerender/chunks/*.mjs` and
    // `<root>/.astro/.prerender/chunks/*.mjs`) that import Astro's own runtime
    // deps (e.g. `piccolore`) by package name. Node ESM's parent-walk from
    // those chunk paths must find a `node_modules/<dep>` somewhere.
    //
    // When tangly is installed alongside the user's project (`bun add tangly`,
    // `npm i -D tangly`), this works: the chunks live in `<project>/dist/...`
    // and walk up to `<project>/node_modules/piccolore`.
    //
    // When tangly is installed elsewhere (`npm i -g tangly`, install.sh's
    // per-version cache, `bunx`/`npx` scratch dirs), the chunks end up at
    // `<user-cwd>/dist/.prerender/...` with no node_modules anywhere on the
    // walk — Astro fails with `ERR_MODULE_NOT_FOUND`.
    //
    // Fix: build into a tmp staging dir with a `node_modules` symlink pointing
    // at tangly's actual install location, then move the result into the
    // user's outDir. Walks now resolve regardless of how tangly was installed.
    // Walk-up chain of node_modules dirs that look like tangly's install.
    // [0] = deepest (closest to source), [N-1] = topmost.
    const nmChain = findTanglyNodeModulesChain(runtimeDir);
    let stagingDir: string;
    if (nmChain.length > 1) {
      // Workspace mode: deps are split across packages/tangly/node_modules
      // (direct, e.g. shiki) AND repo root node_modules (hoisted transitives,
      // e.g. hast-util-from-html). A single symlink can't cover both. Place
      // staging adjacent to the deepest node_modules so Node's natural ESM
      // walk-up traverses every level.
      stagingDir = mkdtempSync(join(dirname(nmChain[0]!), ".tangly-build-"));
    } else {
      // Single-node_modules install (global, bunx, flat npm): /tmp staging
      // with one symlink is enough — that node_modules has everything.
      stagingDir = mkdtempSync(join(tmpdir(), "tangly-build-"));
      if (nmChain[0]) {
        symlinkSync(nmChain[0], join(stagingDir, "node_modules"), "dir");
      }
    }
    const stagingOut = join(stagingDir, "dist");

    // Astro reads `process.cwd()` for some intermediate paths (`.astro/`
    // cache, prerender chunk dir). Run the build from inside the staging
    // dir so those land adjacent to the symlinked node_modules and resolve
    // correctly. Restore cwd once done — the rest of build.ts (manifest,
    // copyStaticAssets, pagefind) reads paths absolute, but other tools
    // invoked later might assume the original cwd.
    const originalCwd = process.cwd();
    try {
      process.chdir(stagingDir);
      const { build } = (await import("astro")) as typeof import("astro");
      await build({
        root: runtimeDir,
        outDir: stagingOut,
        build: {
          format: "directory",
        },
        base: args.base,
      } as never);

      process.chdir(originalCwd);

      if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      }
      cpSync(stagingOut, outDir, { recursive: true, dereference: true });
    } finally {
      try {
        process.chdir(originalCwd);
      } catch {
        // best-effort
      }
      // Windows holds handles on the staging tree briefly after Astro/Vite
      // exits, so the remove can hit EBUSY. rmSync retries those (only when
      // recursive). Output is already copied to outDir by here, so a stubborn
      // lock should leave a temp dir behind, not fail an otherwise-good build.
      try {
        rmSync(stagingDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } catch (err) {
        console.warn(
          pc.yellow(
            `⚠ Could not remove build staging dir ${stagingDir}: ${(err as Error).message}`,
          ),
        );
      }
    }

    // Snapshot what Astro just emitted so copyStaticAssets can hard-protect
    // those paths (refusing user files that would clobber hashed assets).
    const astroEmitted = await snapshotEmittedPaths(outDir);

    // Copy everything from the docs root (gated by .gitignore + .tanglyignore
    // + a baseline) into the build output. Theme cascade still runs first.
    const assetsResult = await copyStaticAssets({ manifest, outDir, astroEmitted });

    // Sitemap, llms.txt, llms-full.txt, robots.txt, per-page <slug>.md
    // Sitemap / robots / llms.txt are production SEO artifacts — use the
    // canonical (prod) URL, which honors --site-url / --env / platform detection.
    const site = resolveSite({
      docsSiteUrl: (manifest.config as { siteUrl?: string }).siteUrl,
      env: process.env,
    });
    const opts: Parameters<typeof writeBuildOutputs>[0] = { manifest, outDir, base: args.base };
    if (site.canonicalUrl) opts.siteUrl = site.canonicalUrl;
    const buildOutputs = writeBuildOutputs(opts);

    // Pagefind: search index over rendered HTML. Done last so it sees
    // every static asset already in place.
    let pagefindIndexed = 0;
    let pagefindExcluded = 0;
    try {
      const pf = await runPagefind({ manifest, outDir, userRoot, base: args.base });
      pagefindIndexed = pf.indexed;
      pagefindExcluded = pf.excluded.length;
    } catch (err) {
      console.warn(pc.yellow(`⚠ Pagefind indexing failed: ${(err as Error).message}`));
    }

    console.log(pc.green(`✓ Built → ${outDir}`));
    if (assetsResult.copied.length > 0) {
      console.log(pc.dim(`  Copied static: ${assetsResult.copied.join(", ")}`));
    }
    console.log(
      pc.dim(
        `  Generated sitemap.xml, robots.txt, llms.txt, llms-full.txt, ${buildOutputs.pageMarkdown} agent .md`,
      ),
    );
    if (pagefindIndexed > 0) {
      const note = pagefindExcluded > 0 ? `, ${pagefindExcluded} excluded` : "";
      console.log(pc.dim(`  Pagefind: ${pagefindIndexed} pages indexed${note}`));
    }

    if (args.analyze) {
      const report = buildBuildReport(outDir);
      const paths = writeBuildReport(outDir, report);
      const t = report.totals;
      console.log(pc.cyan("\n▲ Build report"));
      console.log(
        pc.dim(
          `  ${t.pages} pages · HTML ${(t.htmlBytes / 1024).toFixed(0)} KB · JS ${(t.jsBytes / 1024).toFixed(0)} KB · CSS ${(t.cssBytes / 1024).toFixed(0)} KB`,
        ),
      );
      console.log(pc.dim(`  Wrote ${paths.html.replace(outDir, "dist")}`));
      if (report.warnings.length > 0) {
        console.log(pc.yellow(`  ${report.warnings.length} size warning(s):`));
        for (const w of report.warnings.slice(0, 5)) {
          console.log(pc.dim(`    • ${w}`));
        }
      }
    }
  },
});

/**
 * Find the `node_modules/` to expose to Astro's prerender chunks.
 *
 * Walks up the filesystem from the CLI's source dir, collecting every
 * `node_modules/` that contains tangly's runtime deps (`piccolore` as
 * the canary). Returns the *outermost* match — the deepest-up directory
 * with piccolore.
 *
 * Why outermost: in a workspace with bun's isolated install, both
 * `<pkg>/node_modules/` (per-package, narrow) and `<workspace>/node_modules/`
 * (shared, full) contain piccolore, but only the workspace-root copy
 * carries every transitive (hast-util-*, unist-*, theme-ui's deps, etc.).
 * In a published install there's only one level so "outermost" still wins.
 */
function findTanglyNodeModulesChain(runtimeDir: string): string[] {
  // Collect every node_modules dir on the walk-up that holds tangly's
  // marker dep (piccolore). Workspace bun installs split deps between
  // packages/tangly/node_modules (direct, e.g. shiki) and the repo root
  // node_modules (hoisted transitives). Returning the full chain lets the
  // caller decide whether one symlink suffices or staging needs to live
  // adjacent to the deepest level so all are walked naturally.
  const seen = new Set<string>();
  const chain: string[] = [];
  const starts = [dirname(fileURLToPath(import.meta.url)), runtimeDir];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 20; i++) {
      const nm = join(dir, "node_modules");
      if (!seen.has(nm) && existsSync(join(nm, "piccolore"))) {
        seen.add(nm);
        chain.push(nm);
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return chain;
}

function autoDetectAdapter(root: string): string {
  if (existsSync(resolve(root, "vercel.json"))) return "vercel";
  if (existsSync(resolve(root, "wrangler.toml")) || existsSync(resolve(root, "wrangler.jsonc"))) {
    return "cloudflare";
  }
  if (existsSync(resolve(root, "Dockerfile"))) return "node";
  return "static";
}

/**
 * Walk outDir and return every relative POSIX path Astro just emitted.
 * Used by copyStaticAssets to refuse passthrough overlays that would
 * clobber Astro's hashed assets.
 */
async function snapshotEmittedPaths(outDir: string): Promise<Set<string>> {
  const { readdir } = await import("node:fs/promises");
  const { sep } = await import("node:path");
  const out = new Set<string>();
  if (!existsSync(outDir)) return out;
  const stack: string[] = [outDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = resolve(dir, entry.name);
      const rel = abs
        .slice(outDir.length + 1)
        .split(sep)
        .join("/");
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        out.add(rel);
      }
    }
  }
  return out;
}
