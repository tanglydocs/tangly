import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { buildBuildReport, writeBuildReport } from "../../build-outputs/build-report.js";
import { copyStaticAssets } from "../../build-outputs/copy-assets.js";
import { writeBuildOutputs } from "../../build-outputs/index.js";
import { runPagefind } from "../../build-outputs/run-pagefind.js";
import { buildManifest } from "../../manifest/index.js";
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
    analyze: {
      type: "boolean",
      description: "Write a build-size report to dist/_tangly/",
      default: false,
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const outDir = resolve(userRoot, args.out);

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

    // Validate first
    const manifest = await buildManifest({ root: userRoot, configFile: args.config });
    console.log(pc.dim(`  ${manifest.pages.size} pages, ${manifest.warnings.length} warnings`));

    const runtimeDir = getRuntimeDir();

    const { build } = (await import("astro")) as typeof import("astro");
    await build({
      root: runtimeDir,
      outDir,
      build: {
        format: "directory",
      },
      base: args.base,
    } as never);

    // Snapshot what Astro just emitted so copyStaticAssets can hard-protect
    // those paths (refusing user files that would clobber hashed assets).
    const astroEmitted = await snapshotEmittedPaths(outDir);

    // Copy everything from the docs root (gated by .gitignore + .tanglyignore
    // + a baseline) into the build output. Theme cascade still runs first.
    const assetsResult = await copyStaticAssets({ manifest, outDir, astroEmitted });

    // Sitemap, llms.txt, llms-full.txt, robots.txt, per-page <slug>.md
    const siteUrl = (manifest.config as { siteUrl?: string }).siteUrl;
    const opts: Parameters<typeof writeBuildOutputs>[0] = { manifest, outDir, base: args.base };
    if (siteUrl) opts.siteUrl = siteUrl;
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
