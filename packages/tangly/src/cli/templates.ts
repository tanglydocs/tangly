import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Template {
  name: string;
  label: string;
  description: string;
  files: string[];
}

export interface ApplyTemplateOptions {
  template: string;
  dir: string;
  name: string;
}

export interface ApplyResult {
  written: string[];
  skipped: string[];
}

/**
 * Resolve `dist/templates/` relative to the compiled CLI bundle.
 * At runtime this file lives at `dist/cli/templates.js`, so the
 * templates dir is one level up.
 */
function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "templates");
}

export function listTemplates(): Template[] {
  const indexPath = join(templatesRoot(), "index.json");
  if (!existsSync(indexPath)) return [];
  return JSON.parse(readFileSync(indexPath, "utf8")) as Template[];
}

export function getTemplate(name: string): Template | undefined {
  return listTemplates().find((t) => t.name === name);
}

export async function applyTemplate(opts: ApplyTemplateOptions): Promise<ApplyResult> {
  const tpl = getTemplate(opts.template);
  if (!tpl) {
    throw new Error(
      `Unknown template "${opts.template}". Available: ${listTemplates()
        .map((t) => t.name)
        .join(", ")}`,
    );
  }

  const srcRoot = join(templatesRoot(), tpl.name);
  if (!existsSync(srcRoot) || !statSync(srcRoot).isDirectory()) {
    throw new Error(`Template "${tpl.name}" missing source at ${srcRoot}`);
  }

  await mkdir(opts.dir, { recursive: true });

  const planned = tpl.files.map((rel) => ({
    rel,
    src: join(srcRoot, rel),
    dest: join(opts.dir, rel),
    skip: existsSync(join(opts.dir, rel)),
  }));

  await Promise.all(
    planned
      .filter((p) => !p.skip)
      .map(async (p) => {
        await mkdir(dirname(p.dest), { recursive: true });
        const contents = await readFile(p.src, "utf8");
        await writeFile(p.dest, substitute(contents, opts.name), "utf8");
      }),
  );

  return {
    written: planned.filter((p) => !p.skip).map((p) => p.rel),
    skipped: planned.filter((p) => p.skip).map((p) => p.rel),
  };
}

function substitute(contents: string, name: string): string {
  return contents.replaceAll("{{name}}", name);
}
