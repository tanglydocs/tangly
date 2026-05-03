#!/usr/bin/env bun
/**
 * Copies install scripts and the docs.json schema from the main Tangly repo
 * into website/public/ so they're served at the root of tangly.dev.
 * Single source of truth: ../install.sh, ../install.ps1, ../packages/schema/dist/docs.json.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const websiteRoot = resolve(import.meta.dir, "..");
const mainRepo = resolve(websiteRoot, "../..");

const assets: Array<{ from: string; to: string }> = [
  {
    from: resolve(mainRepo, "install.sh"),
    to: resolve(websiteRoot, "public/install.sh"),
  },
  {
    from: resolve(mainRepo, "install.ps1"),
    to: resolve(websiteRoot, "public/install.ps1"),
  },
  {
    from: resolve(mainRepo, "packages/schema/dist/docs.json"),
    to: resolve(websiteRoot, "public/schema/docs.json"),
  },
];

let hadError = false;

for (const { from, to } of assets) {
  if (!existsSync(from)) {
    console.error(`✗ missing source: ${from}`);
    hadError = true;
    continue;
  }
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  console.log(`✓ ${from.replace(mainRepo + "/", "")} → ${to.replace(websiteRoot + "/", "")}`);
}

if (hadError) {
  console.error(
    "\nOne or more assets are missing. For the schema, run from the main repo: " +
      "`bun run --filter @tanglydocs/schema build`",
  );
  process.exit(1);
}
