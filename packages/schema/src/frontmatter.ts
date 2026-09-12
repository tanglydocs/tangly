import { z } from "zod";

export const PageModeSchema = z.enum(["default", "wide", "center", "custom", "frame", "api"]);

/**
 * A date in frontmatter, normalized to an ISO 8601 string.
 *
 * YAML parses an unquoted `2026-01-02` into a JavaScript `Date`, not a string
 * — so a schema that accepted only `z.string()` here would reject the most
 * natural way to write the field and fail the whole page's frontmatter. Accept
 * both and hand every consumer a string.
 */
const IsoDateSchema = z.union([z.string(), z.date().transform((d) => d.toISOString())]);

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
    /** Override the playground mode for this page (`api`/`openapi` pages). */
    playground: z.enum(["interactive", "simple", "none"]).optional(),
    /** Override the auth scheme for the playground (`api`/`openapi` pages). */
    authMethod: z.enum(["bearer", "basic", "key", "none"]).optional(),
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
    lastUpdated: z.union([z.boolean(), IsoDateSchema]).optional(),
    /**
     * Override the page's reading-time stamp. `false` hides it. Number
     * overrides the auto-computed minutes.
     */
    readingTime: z.union([z.boolean(), z.number()]).optional(),
    /** Override the page's edit-on-source URL. */
    editUrl: z.string().optional(),
    /** Disable glossary auto-linking on this page. */
    glossary: z.boolean().optional(),
    /** Emit JSON-LD structured data for this page. `false` opts it out. */
    jsonld: z.boolean().optional(),
    /**
     * Override the JSON-LD article `@type` for this page (default
     * `TechArticle`, or `Article` under a blog/changelog nav group).
     */
    schemaType: z.string().optional(),
    /**
     * Page author. Emitted as a JSON-LD `Person` node and referenced as the
     * article's author in place of the publishing organization.
     */
    author: z
      .union([z.string(), z.object({ name: z.string(), url: z.string().optional() }).strict()])
      .optional(),
    /**
     * ISO 8601 date overriding the git-derived first-commit date in JSON-LD
     * `datePublished`.
     */
    datePublished: IsoDateSchema.optional(),
    /**
     * ISO 8601 date overriding the git-derived last-commit date in JSON-LD
     * `dateModified`.
     */
    dateModified: IsoDateSchema.optional(),
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
