import { z } from "zod";

const PagePath = z.string().min(1);

const Tag = z.string().optional();
const Icon = z
  .union([z.string(), z.object({ name: z.string(), library: z.string().optional() })])
  .optional();

/**
 * Mintlify's OpenAPI/AsyncAPI reference: a single path/URL, an array of them,
 * or a `{ source, directory }` object (the object form scopes generated pages
 * under `directory`). Accepted on tabs, groups, and anchors. Use
 * `openApiSource()` to extract the primary source string.
 */
export const OpenApiRefSchema = z.union([
  z.string(),
  z.array(z.string()),
  z
    .object({
      source: z.union([z.string(), z.array(z.string())]),
      directory: z.string().optional(),
    })
    .strict(),
]);

export type OpenApiRef = z.infer<typeof OpenApiRefSchema>;

/** Primary spec source for an `OpenApiRef` (first entry of any array/object form). */
export function openApiSource(ref: OpenApiRef | undefined): string | undefined {
  if (ref === undefined) return undefined;
  if (typeof ref === "string") return ref;
  if (Array.isArray(ref)) return ref[0];
  return Array.isArray(ref.source) ? ref.source[0] : ref.source;
}

const NavGroupBase = z.object({
  group: z.string(),
  icon: Icon,
  root: z.string().optional(),
  tag: Tag,
  expanded: z.boolean().optional(),
  template: z.string().optional(),
  // Group-scoped OpenAPI spec. Mintlify expands it into per-endpoint pages
  // nested under this group (see issue #6's `groups[].openapi`).
  openapi: OpenApiRefSchema.optional(),
});

const NavTabBase = z.object({
  tab: z.string(),
  icon: Icon,
  href: z.string().optional(),
  openapi: OpenApiRefSchema.optional(),
  template: z.string().optional(),
});

const NavAnchorBase = z.object({
  anchor: z.string(),
  icon: Icon,
  href: z.string().optional(),
});

const NavDropdownBase = z.object({
  dropdown: z.string(),
  icon: Icon,
  href: z.string().optional(),
});

const NavVersionBase = z.object({
  version: z.string(),
  default: z.boolean().optional(),
});

const NavLanguageBase = z.object({
  language: z.string(),
});

export const NavGroupSchema: z.ZodType<NavGroup> = z.lazy(() =>
  NavGroupBase.extend({
    // Mintlify groups may omit `pages` (a group that only nests other groups,
    // or is driven by `openapi`/`asyncapi`). Requiring `pages` rejected real
    // configs — see issue #6 (`navigation.tabs[].groups[].pages` undefined).
    pages: z.array(NavNodeSchema).optional(),
  }),
);

export const NavAnchorSchema: z.ZodType<NavAnchor> = z.lazy(() =>
  NavAnchorBase.extend({
    pages: z.array(NavNodeSchema).optional(),
    groups: z.array(NavGroupSchema).optional(),
  }),
);

export const NavDropdownSchema: z.ZodType<NavDropdown> = z.lazy(() =>
  NavDropdownBase.extend({
    pages: z.array(NavNodeSchema).optional(),
    groups: z.array(NavGroupSchema).optional(),
  }),
);

export const NavTabSchema: z.ZodType<NavTab> = z.lazy(() =>
  NavTabBase.extend({
    pages: z.array(NavNodeSchema).optional(),
    groups: z.array(NavGroupSchema).optional(),
    anchors: z.array(NavAnchorSchema).optional(),
  }),
);

export const NavVersionSchema: z.ZodType<NavVersion> = z.lazy(() =>
  NavVersionBase.extend({
    pages: z.array(NavNodeSchema).optional(),
    groups: z.array(NavGroupSchema).optional(),
    tabs: z.array(NavTabSchema).optional(),
  }),
);

export const NavLanguageSchema: z.ZodType<NavLanguage> = z.lazy(() =>
  NavLanguageBase.extend({
    pages: z.array(NavNodeSchema).optional(),
    groups: z.array(NavGroupSchema).optional(),
    tabs: z.array(NavTabSchema).optional(),
  }),
);

export const NavNodeSchema: z.ZodType<NavNode> = z.lazy(() =>
  z.union([
    PagePath,
    NavGroupSchema,
    NavTabSchema,
    NavAnchorSchema,
    NavDropdownSchema,
    NavVersionSchema,
    NavLanguageSchema,
  ]),
);

export const GlobalNavSchema = z.object({
  anchors: z.array(NavAnchorSchema).optional(),
  dropdowns: z.array(NavDropdownSchema).optional(),
  tabs: z.array(NavTabSchema).optional(),
});

export const NavigationSchema = z.object({
  pages: z.array(NavNodeSchema).optional(),
  groups: z.array(NavGroupSchema).optional(),
  tabs: z.array(NavTabSchema).optional(),
  anchors: z.array(NavAnchorSchema).optional(),
  dropdowns: z.array(NavDropdownSchema).optional(),
  versions: z.array(NavVersionSchema).optional(),
  languages: z.array(NavLanguageSchema).optional(),
  products: z.array(z.unknown()).optional(),
  global: GlobalNavSchema.optional(),
});

export type NavGroup = z.output<typeof NavGroupBase> & {
  pages?: NavNode[];
};
export type NavAnchor = z.output<typeof NavAnchorBase> & {
  pages?: NavNode[];
  groups?: NavGroup[];
};
export type NavDropdown = z.output<typeof NavDropdownBase> & {
  pages?: NavNode[];
  groups?: NavGroup[];
};
export type NavTab = z.output<typeof NavTabBase> & {
  pages?: NavNode[];
  groups?: NavGroup[];
  anchors?: NavAnchor[];
};
export type NavVersion = z.output<typeof NavVersionBase> & {
  pages?: NavNode[];
  groups?: NavGroup[];
  tabs?: NavTab[];
};
export type NavLanguage = z.output<typeof NavLanguageBase> & {
  pages?: NavNode[];
  groups?: NavGroup[];
  tabs?: NavTab[];
};

export type NavNode =
  | string
  | NavGroup
  | NavTab
  | NavAnchor
  | NavDropdown
  | NavVersion
  | NavLanguage;

export type Navigation = z.infer<typeof NavigationSchema>;
