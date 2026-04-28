import { z } from "zod";
import { ColorsSchema } from "./colors.js";
import { NavigationSchema } from "./navigation.js";
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
        method: z.enum(["bearer", "basic", "key", "cookie", "none"]).optional(),
        name: z.string().optional(),
      })
      .strict()
      .optional(),
    playground: z
      .object({
        mode: z.enum(["interactive", "simple", "hide"]).optional(),
        proxy: z.boolean().optional(),
      })
      .strict()
      .optional(),
    openapi: z.union([z.string(), z.array(z.string())]).optional(),
    asyncapi: z.union([z.string(), z.array(z.string())]).optional(),
    mdx: z
      .object({
        server: z.union([z.string(), z.array(z.string())]).optional(),
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
    options: z.array(z.enum(["copy", "view", "chatgpt", "claude"])).optional(),
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
    background: z.string().optional(),
  })
  .strict()
  .optional();

export const DocsJsonSchema = z
  .object({
    $schema: z.string().optional(),
    theme: ThemeSchema.optional(),
    name: z.string().min(1),
    description: z.string().optional(),
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
  return DocsJsonSchema.parse(input);
}

export function safeParseDocsJson(input: unknown) {
  return DocsJsonSchema.safeParse(input);
}
