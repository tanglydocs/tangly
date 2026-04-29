import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
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
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const outDir = resolve(userRoot, args.out);

    const adapter = args.adapter ?? autoDetectAdapter(userRoot);
    const validAdapters = ["vercel", "cloudflare", "node", "static"] as const;
    if (!(validAdapters as readonly string[]).includes(adapter)) {
      console.error(
        pc.red(
          `✗ Unknown --adapter "${adapter}". Expected: ${validAdapters.join(" | ")}.`,
        ),
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

    // Copy Mintlify-style static directories (images/, logo/, etc.) and
    // the configured favicon into the build output.
    const assetsResult = await copyStaticAssets({ manifest, outDir });

    // Sitemap, llms.txt, llms-full.txt, robots.txt
    const siteUrl = (manifest.config as { siteUrl?: string }).siteUrl;
    const opts: Parameters<typeof writeBuildOutputs>[0] = { manifest, outDir };
    if (siteUrl) opts.siteUrl = siteUrl;
    writeBuildOutputs(opts);

    // Pagefind: search index over rendered HTML. Done last so it sees
    // every static asset already in place.
    let pagefindIndexed = 0;
    let pagefindExcluded = 0;
    try {
      const pf = await runPagefind({ manifest, outDir, userRoot });
      pagefindIndexed = pf.indexed;
      pagefindExcluded = pf.excluded.length;
    } catch (err) {
      console.warn(pc.yellow(`⚠ Pagefind indexing failed: ${(err as Error).message}`));
    }

    console.log(pc.green(`✓ Built → ${outDir}`));
    if (assetsResult.copied.length > 0) {
      console.log(pc.dim(`  Copied static: ${assetsResult.copied.join(", ")}`));
    }
    console.log(pc.dim(`  Generated sitemap.xml, robots.txt, llms.txt, llms-full.txt`));
    if (pagefindIndexed > 0) {
      const note = pagefindExcluded > 0 ? `, ${pagefindExcluded} excluded` : "";
      console.log(pc.dim(`  Pagefind: ${pagefindIndexed} pages indexed${note}`));
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
