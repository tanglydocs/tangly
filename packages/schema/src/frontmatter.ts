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
    /**
     * Override the page's last-updated stamp. `false` hides it. ISO date
     * string overrides the git-derived value.
     */
    lastUpdated: z.union([z.boolean(), z.string()]).optional(),
    /**
     * Override the page's reading-time stamp. `false` hides it. Number
     * overrides the auto-computed minutes.
     */
    readingTime: z.union([z.boolean(), z.number()]).optional(),
    /** Override the page's edit-on-source URL. */
    editUrl: z.string().optional(),
    /** Disable glossary auto-linking on this page. */
    glossary: z.boolean().optional(),
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
