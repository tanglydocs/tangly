#!/usr/bin/env bun
/**
 * Copy each `packages/template-*\/files/` tree into
 * `packages/tangly/dist/templates/{name}/` and emit
 * `dist/templates/index.json` describing the bundle.
 *
 * Runs as `prebuild` so `tsgo --build` ships the templates with the CLI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TANGLY_PKG = resolve(HERE, "..");
const PACKAGES_DIR = resolve(TANGLY_PKG, "..");
const OUT_DIR = resolve(TANGLY_PKG, "dist", "templates");

interface TemplateManifest {
  name: string;
  label: string;
  description: string;
}

interface BundledTemplate extends TemplateManifest {
  files: string[];
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const dirs = readdirSync(PACKAGES_DIR).filter((d) => d.startsWith("template-"));

  const bundled = (
    await Promise.all(
      dirs.map(async (dir): Promise<BundledTemplate | null> => {
        const root = join(PACKAGES_DIR, dir);
        const manifestPath = join(root, "template.json");
        const filesDir = join(root, "files");
        if (!exists(manifestPath) || !exists(filesDir)) return null;

        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as TemplateManifest;
        const target = join(OUT_DIR, manifest.name);
        await cp(filesDir, target, { recursive: true });

        const files: string[] = [];
        walk(target, target, files);
        console.log(`bundled ${manifest.name}: ${files.length} files → ${target}`);
        return { ...manifest, files: files.toSorted() };
      }),
    )
  ).filter((b): b is BundledTemplate => b !== null);

  bundled.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(join(OUT_DIR, "index.json"), `${JSON.stringify(bundled, null, 2)}\n`, "utf8");
  console.log(`wrote ${bundled.length} template(s) to ${OUT_DIR}`);
}

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function walk(root: string, dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(root, full, out);
      continue;
    }
    if (!stats.isFile()) continue;
    out.push(
      full
        .slice(root.length + 1)
        .split("\\")
        .join("/"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
