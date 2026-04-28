import type { z } from "zod";

export interface CollectionDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  schema: S;
  /** Glob pattern relative to the collection's directory. Default: "**" + "/*.mdx". */
  pattern?: string;
  /** Directory under the project root containing entries. Default: collection name. */
  dir?: string;
}

/** Author shorthand: define a collection's schema (Zod) + glob pattern. */
export function defineCollection<S extends z.ZodTypeAny>(
  def: CollectionDefinition<S>,
): CollectionDefinition<S> {
  return def;
}

export interface CollectionEntry<S extends z.ZodTypeAny = z.ZodTypeAny> {
  slug: string;
  file: string;
  data: z.infer<S>;
  body: string;
}

export interface TanglyConfig {
  collections?: Record<string, CollectionDefinition>;
}

/** Author shorthand: type the user's `tangly.config.ts` export. */
export function defineConfig(cfg: TanglyConfig): TanglyConfig {
  return cfg;
}
