import { z } from "zod";

const PagePath = z.string().min(1);

const Tag = z.string().optional();
const Icon = z
  .union([z.string(), z.object({ name: z.string(), library: z.string().optional() })])
  .optional();

const NavGroupBase = z.object({
  group: z.string(),
  icon: Icon,
  root: z.string().optional(),
  tag: Tag,
  expanded: z.boolean().optional(),
});

const NavTabBase = z.object({
  tab: z.string(),
  icon: Icon,
  href: z.string().optional(),
  openapi: z.string().optional(),
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
    pages: z.array(NavNodeSchema),
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
  pages: NavNode[];
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
