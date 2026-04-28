import { z } from "zod";

export const PageModeSchema = z.enum(["default", "wide", "center", "custom"]);

export const FrontmatterSchema = z
  .object({
    // Title is conventionally required by Mintlify but real corpora ship many
    // pages without it (release notes, drafts). Fall back to humanized slug
    // at render time. Validation surfaces a warning rather than failing.
    title: z.string().optional(),
    sidebarTitle: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    tag: z.string().optional(),
    api: z.string().optional(),
    openapi: z.string().optional(),
    "openapi-schema": z.string().optional(),
    keywords: z.array(z.string()).optional(),
    noindex: z.boolean().optional(),
    mode: PageModeSchema.optional(),
    draft: z.boolean().optional(),
    template: z.string().optional(),
    aiContext: z.string().optional(),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        ogImage: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export function parseFrontmatter(input: unknown): Frontmatter {
  return FrontmatterSchema.parse(input);
}

export function safeParseFrontmatter(input: unknown) {
  return FrontmatterSchema.safeParse(input);
}
