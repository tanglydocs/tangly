import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import matter from "gray-matter";
import type { CollectionEntry, TanglyConfig } from "./define.js";

export interface LoadedCollections {
  /** Per-collection arrays of validated entries. */
  data: Record<string, CollectionEntry[]>;
  /** Validation issues grouped by collection name. */
  errors: Array<{ collection: string; file: string; message: string }>;
}

/**
 * Load `tangly.config.ts` (or .js / .mjs) from the project root, then walk
 * each collection's directory and validate every entry against its Zod
 * schema. Build-time only.
 */
export async function loadCollections(userRoot: string): Promise<LoadedCollections> {
  const configPath = findConfigPath(userRoot);
  if (!configPath) return { data: {}, errors: [] };

  const cfg = await loadUserConfig(configPath);
  if (!cfg.collections) return { data: {}, errors: [] };

  const data: Record<string, CollectionEntry[]> = {};
  const errors: LoadedCollections["errors"] = [];

  for (const [name, def] of Object.entries(cfg.collections)) {
    const dir = resolve(userRoot, def.dir ?? name);
    if (!existsSync(dir)) {
      data[name] = [];
      continue;
    }
    const entries: CollectionEntry[] = [];
    // eslint-disable-next-line no-await-in-loop -- per-collection sequential is intentional
    const files = await walkMdx(dir);
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const parsed = matter(raw);
      const slug = relative(dir, file)
        .replace(/\.(mdx|md)$/, "")
        .split(sep)
        .join("/");
      const result = def.schema.safeParse(parsed.data);
      if (!result.success) {
        errors.push({
          collection: name,
          file,
          message: result.error.message,
        });
        continue;
      }
      entries.push({
        slug,
        file,
        data: result.data,
        body: parsed.content,
      });
    }
    data[name] = entries;
  }

  return { data, errors };
}

function findConfigPath(userRoot: string): string | null {
  const candidates = [
    "tangly.config.ts",
    "tangly.config.mts",
    "tangly.config.js",
    "tangly.config.mjs",
  ];
  for (const c of candidates) {
    const p = resolve(userRoot, c);
    if (existsSync(p)) return p;
  }
  return null;
}

async function loadUserConfig(path: string): Promise<TanglyConfig> {
  // bun + node both support direct ESM import of .ts/.js/.mjs at this layer.
  const mod = (await import(path)) as { default?: TanglyConfig } & TanglyConfig;
  return mod.default ?? mod;
}

async function walkMdx(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- recursive walk
      await walkMdx(full, out);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (ext === ".mdx" || ext === ".md") out.push(full);
    }
  }
  return out;
}

/**
 * Reduce loaded collection data into a serializable shape suitable for
 * embedding in the manifest virtual module.
 */
export function serializeCollections(
  loaded: LoadedCollections["data"],
): Record<string, Array<{ slug: string; file: string; data: unknown; body: string }>> {
  const out: Record<
    string,
    Array<{ slug: string; file: string; data: unknown; body: string }>
  > = {};
  for (const [name, entries] of Object.entries(loaded)) {
    out[name] = entries.map((e) => ({
      slug: e.slug,
      file: e.file,
      data: e.data,
      body: e.body,
    }));
  }
  return out;
}
