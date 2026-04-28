import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
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
    console.log(pc.cyan(`▲ Building Tangly project (${adapter})…`));

    process.env.TANGLY_USER_ROOT = userRoot;
    process.env.TANGLY_CONFIG_FILE = args.config;
    process.env.TANGLY_BASE = args.base;

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

    console.log(pc.green(`✓ Built → ${outDir}`));
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
