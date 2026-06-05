import { z } from "zod";
import { ColorsSchema } from "./colors.js";
import { NavigationSchema } from "./navigation.js";
import { normalizeDocsJson } from "./normalize.js";
import { ThemeSchema } from "./themes.js";

const LogoSchema = z
  .union([
    z.string(),
    z
      .object({
        light: z.string().optional(),
        dark: z.string().optional(),
        href: z.string().optional(),
      })
      .strict(),
  ])
  .optional();

const NavbarLink = z
  .object({
    label: z.string(),
    href: z.string(),
    icon: z.unknown().optional(),
  })
  .strict();

const NavbarPrimary = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("button"),
      label: z.string(),
      href: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("github"),
      href: z.string(),
    })
    .strict(),
]);

const NavbarSchema = z
  .object({
    links: z.array(NavbarLink).optional(),
    primary: NavbarPrimary.optional(),
  })
  .strict()
  .optional();

const FooterSchema = z
  .object({
    socials: z.record(z.string(), z.string()).optional(),
    links: z
      .array(
        z
          .object({
            header: z.string().optional(),
            items: z.array(NavbarLink),
          })
          .strict(),
      )
      .optional(),
    /** Show last-updated timestamps on every page footer (default: false). */
    lastUpdated: z.boolean().optional(),
    /**
     * Edit-this-page URL template. `{path}` is substituted with the page
     * file's path relative to the project root (e.g.
     * "https://github.com/owner/repo/edit/main/{path}").
     */
    editUrl: z.string().optional(),
    /**
     * Repository URL — used to derive `editUrl` if not set explicitly.
     * Falls back to `git remote get-url origin` when omitted.
     */
    repo: z.string().optional(),
  })
  .strict()
  .optional();

const RedirectSchema = z
  .object({
    source: z.string(),
    destination: z.string(),
    permanent: z.boolean().optional(),
  })
  .strict();

const SeoSchema = z
  .object({
    metatags: z.record(z.string(), z.string()).optional(),
    indexing: z.enum(["all", "navigable"]).optional(),
  })
  .strict()
  .optional();

const AnalyticsSchema = z
  .object({
    posthog: z
      .object({
        apiKey: z.string(),
        apiHost: z.string().optional(),
      })
      .optional(),
    plausible: z
      .object({
        domain: z.string(),
      })
      .optional(),
    fathom: z
      .object({
        siteId: z.string(),
      })
      .optional(),
    ga4: z
      .object({
        measurementId: z.string(),
      })
      .optional(),
    gtm: z
      .object({
        tagId: z.string(),
      })
      .optional(),
    amplitude: z
      .object({
        apiKey: z.string(),
      })
      .optional(),
    hotjar: z
      .object({
        hjid: z.string(),
        hjsv: z.string().optional(),
      })
      .optional(),
    mixpanel: z
      .object({
        projectToken: z.string(),
      })
      .optional(),
    segment: z
      .object({
        key: z.string(),
      })
      .optional(),
    pirsch: z
      .object({
        id: z.string(),
      })
      .optional(),
    logrocket: z
      .object({
        apiKey: z.string(),
      })
      .optional(),
    heap: z
      .object({
        appId: z.string(),
      })
      .optional(),
  })
  .strict()
  .optional();

const ApiSchema = z
  .object({
    baseUrl: z.union([z.string(), z.array(z.string())]).optional(),
    auth: z
      .object({
        // `cookie` removed: browser fetch can't set Cookie headers from
        // user-supplied values. Same-origin requests already get the
        // browser's cookies via credentials: "include" — exposed via the
        // try-it-out form's "session" toggle, not as a separate auth mode.
        method: z.enum(["bearer", "basic", "key", "none"]).optional(),
        name: z.string().optional(),
      })
      .strict()
      .optional(),
    playground: z
      .object({
        mode: z.enum(["interactive", "simple", "hide"]).optional(),
        proxy: z.boolean().optional(),
        /** Forward cookies + Authorization on cross-origin try-it requests when proxy is false. */
        credentials: z.boolean().optional(),
      })
      .strict()
      .optional(),
    /**
     * Code samples shown in the right-rail playground. Mintlify projects
     * may use `api.examples.*`; aliases are normalized into this shape
     * before parsing (see `normalize.ts`).
     */
    codeSamples: z
      .object({
        /** Tabs to render. Default: `["curl", "typescript", "python"]`. */
        languages: z.array(z.string()).optional(),
        /** Generate samples from the spec when no `<RequestExample>` overrides exist. Default: true. */
        autogenerate: z.boolean().optional(),
        /** Pull example values from the OpenAPI spec into the sample. Default: true. */
        prefill: z.boolean().optional(),
        /** Sample includes only `required` params or `all` of them. Default: required. */
        defaults: z.enum(["required", "all"]).optional(),
      })
      .strict()
      .optional(),
    params: z
      .object({
        /** Default expansion state for the parameter list. */
        expanded: z.enum(["all", "closed"]).optional(),
        /** Extra OpenAPI fields to surface as pills next to the param name. */
        post: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    /** `"full"` shows the complete URL (base + path) in the endpoint header. */
    url: z.literal("full").optional(),
    /**
     * JSON Pointer to a schema in the spec (e.g.
     * `#/components/schemas/APIV4ResponseSchema`) used as the response
     * shape when the actual operation response has an empty `schema: {}`.
     * Mirrors Mintlify's behavior of falling back to the canonical
     * envelope schema for FastAPI-style specs that don't declare each
     * 200's body.
     */
    responseFallback: z.string().optional(),
    openapi: z.union([z.string(), z.array(z.string())]).optional(),
    /** Phase 3: viewer choice. Default: tangly's built-in compact endpoint render. */
    viewer: z.enum(["tangly", "scalar", "redoc", "stoplight"]).optional(),
    asyncapi: z.union([z.string(), z.array(z.string())]).optional(),
    mdx: z
      .object({
        server: z.union([z.string(), z.array(z.string())]).optional(),
        /**
         * Default auth applied to MDX-defined (non-OpenAPI) API pages.
         * `method` is a loose string for forward-compat with Mintlify's enum
         * (bearer/basic/key/cobo/…).
         */
        auth: z
          .object({
            method: z.string().optional(),
            name: z.string().optional(),
          })
          .loose()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

const AppearanceSchema = z
  .object({
    default: z.enum(["light", "dark", "system"]).optional(),
    strict: z.boolean().optional(),
    /** Show estimated reading time in the page header (default: false). */
    readingTime: z.boolean().optional(),
    /** Render a 2px scroll-progress bar across the top (default: false). */
    readingProgress: z.boolean().optional(),
  })
  .strict()
  .optional();

const CodeSchema = z
  .object({
    /** Show a copy-to-clipboard button on every code block (default: true). */
    copyButton: z.boolean().optional(),
    /**
     * Shiki theme(s). String → same theme for light + dark.
     * Object → split. Defaults to github-light/github-dark.
     */
    theme: z
      .union([z.string(), z.object({ light: z.string(), dark: z.string() }).strict()])
      .optional(),
  })
  .strict()
  .optional();

const FontFaceSchema = z
  .object({
    family: z.string(),
    weight: z.union([z.number(), z.string()]).optional(),
    source: z.string().optional(),
    format: z.string().optional(),
  })
  .strict();

const FontsSchema = z
  .object({
    heading: FontFaceSchema.optional(),
    body: FontFaceSchema.optional(),
  })
  .strict()
  .optional();

const StylingSchema = z
  .object({
    eyebrows: z.enum(["section", "breadcrumbs"]).optional(),
    codeblocks: z.enum(["system", "dark"]).optional(),
  })
  .strict()
  .optional();

const IntegrationsSchema = z.record(z.string(), z.unknown()).optional();

const ErrorsSchema = z
  .object({
    "404": z
      .object({
        redirect: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

const ContextualSchema = z
  .object({
    /**
     * Reader-initiated actions exposed in the per-page "Copy page" menu.
     * - `copy`     copy the page's raw Markdown to the clipboard
     * - `copy-url` copy the absolute URL of the Markdown twin
     * - `view`     open the Markdown twin in a new tab
     * - `chatgpt`  open ChatGPT prefilled with the Markdown URL
     * - `claude`   open Claude prefilled with the Markdown URL
     *
     * Tangly renders the five above. The remaining string presets and the
     * custom-object form are Mintlify's full `contextual.options` set, accepted
     * for parity (the menu filters to what it implements, ignoring the rest) so
     * unmodified Mintlify projects parse. Keep the enum in sync with Mintlify's
     * schema (see `packages/schema/fixtures/mintlify/`).
     *
     * Omit `contextual` entirely → all actions show. Empty array → menu hidden.
     */
    options: z
      .array(
        z.union([
          z.enum([
            "copy",
            "copy-url",
            "view",
            "chatgpt",
            "claude",
            "assistant",
            "download-pdf",
            "download-spec",
            "perplexity",
            "grok",
            "aistudio",
            "devin",
            "devin-mcp",
            "windsurf",
            "mcp",
            "add-mcp",
            "cursor",
            "vscode",
          ]),
          // Mintlify custom action: a labeled button with its own href/icon.
          // Unrendered today; `.loose()` keeps us forward-compatible.
          z
            .object({
              title: z.string().optional(),
              description: z.string().optional(),
              // `z.unknown()` is a *required* key in Zod 4 unless marked
              // optional; Mintlify requires none of these.
              icon: z.unknown().optional(),
              href: z.unknown().optional(),
            })
            .loose(),
        ]),
      )
      .optional(),
  })
  .strict()
  .optional();

const BackgroundSchema = z
  .object({
    image: z.string().optional(),
    color: z
      .object({
        light: z.string().optional(),
        dark: z.string().optional(),
      })
      .strict()
      .optional(),
    decoration: z.enum(["gradient", "grid", "windows"]).optional(),
  })
  .strict()
  .optional();

const SearchSchema = z
  .object({
    prompt: z.string().optional(),
  })
  .strict()
  .optional();

const ThumbnailsSchema = z
  .object({
    /**
     * Master switch for auto-generated social cards (Open Graph / Twitter
     * images). Cards generate by default when `siteUrl` is set; set to
     * `false` to disable generation entirely.
     */
    enabled: z.boolean().optional(),
    /** Card background — hex color or absolute image path. Defaults to the theme surface. */
    background: z.string().optional(),
    /** Accent color (hex) for the card. Defaults to `colors.primary`. */
    accent: z.string().optional(),
    /**
     * A single static image used as `og:image` for every page, in place of
     * per-page generated cards. Absolute URL or root-relative path.
     */
    image: z.string().optional(),
  })
  .strict()
  .optional();

export const DocsJsonSchema = z
  .object({
    $schema: z.string().optional(),
    theme: ThemeSchema.optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    siteUrl: z.string().url().optional(),
    colors: ColorsSchema.optional(),
    logo: LogoSchema,
    favicon: z.union([z.string(), z.object({ light: z.string(), dark: z.string() })]).optional(),
    navigation: NavigationSchema,
    navbar: NavbarSchema,
    footer: FooterSchema,
    redirects: z.array(RedirectSchema).optional(),
    seo: SeoSchema,
    analytics: AnalyticsSchema,
    api: ApiSchema,
    appearance: AppearanceSchema,
    code: CodeSchema,
    background: BackgroundSchema,
    fonts: FontsSchema,
    styling: StylingSchema,
    integrations: IntegrationsSchema,
    errors: ErrorsSchema,
    contextual: ContextualSchema,
    search: SearchSchema,
    thumbnails: ThumbnailsSchema,
    metadata: z.record(z.string(), z.string()).optional(),
    banner: z
      .object({
        content: z.string(),
        dismissible: z.boolean().optional(),
        /**
         * Stable ID. Used as the localStorage dismissal key — change the
         * id to re-show after a previous dismiss.
         */
        id: z.string().optional(),
        /** Tone (color). Default: info. */
        type: z.enum(["info", "warning", "success"]).optional(),
      })
      .strict()
      .optional(),
    icons: z
      .object({
        library: z.enum(["lucide", "fontawesome"]).optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export type DocsJson = z.infer<typeof DocsJsonSchema>;

export function parseDocsJson(input: unknown): DocsJson {
  return DocsJsonSchema.parse(normalizeDocsJson(input));
}

export function safeParseDocsJson(input: unknown) {
  return DocsJsonSchema.safeParse(normalizeDocsJson(input));
}
