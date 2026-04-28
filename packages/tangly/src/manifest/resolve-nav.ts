import type { DocsJson, Frontmatter, NavGroup, NavNode, NavTab } from "@tangly/schema";

// NavTab type is referenced via tabFromNavTab below.
import type {
  ManifestWarning,
  ResolvedAnchor,
  ResolvedNavigation,
  ResolvedTab,
  SidebarItem,
} from "./types.js";

export interface ResolveOptions {
  config: DocsJson;
  /** Pages on disk keyed by slug. Used for title fallbacks. */
  diskPages: Map<string, { frontmatter: Frontmatter | null }>;
}

export interface ResolveResult {
  navigation: ResolvedNavigation;
  /** Slugs that nav references in declaration order. */
  navSlugs: string[];
  warnings: ManifestWarning[];
}

/** Title for a slug — use sidebarTitle if set, then title, then humanized slug. */
function pageTitle(
  slug: string,
  diskPages: Map<string, { frontmatter: Frontmatter | null }>,
): string {
  const fm = diskPages.get(slug)?.frontmatter;
  return fm?.sidebarTitle ?? fm?.title ?? humanize(slug.split("/").pop() ?? slug);
}

function pageIcon(
  slug: string,
  diskPages: Map<string, { frontmatter: Frontmatter | null }>,
): string | undefined {
  return diskPages.get(slug)?.frontmatter?.icon;
}

function pageTag(
  slug: string,
  diskPages: Map<string, { frontmatter: Frontmatter | null }>,
): string | undefined {
  return diskPages.get(slug)?.frontmatter?.tag;
}

function humanize(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isString(node: NavNode): node is string {
  return typeof node === "string";
}

function isGroup(node: NavNode): node is NavGroup {
  return typeof node === "object" && node !== null && "group" in node;
}

function buildSidebar(
  nodes: NavNode[],
  ctx: ResolveOptions,
  warnings: ManifestWarning[],
  collectedSlugs: Set<string>,
): SidebarItem[] {
  const out: SidebarItem[] = [];
  for (const node of nodes) {
    if (isString(node)) {
      collectedSlugs.add(node);
      const item: SidebarItem = {
        title: pageTitle(node, ctx.diskPages),
        slug: node,
        isGroup: false,
      };
      const icon = pageIcon(node, ctx.diskPages);
      const tag = pageTag(node, ctx.diskPages);
      if (icon !== undefined) item.icon = icon;
      if (tag !== undefined) item.tag = tag;
      out.push(item);
    } else if (isGroup(node)) {
      const children = buildSidebar(node.pages, ctx, warnings, collectedSlugs);
      const item: SidebarItem = {
        title: node.group,
        slug: "",
        isGroup: true,
        children,
      };
      const groupIcon = typeof node.icon === "string" ? node.icon : undefined;
      if (groupIcon) item.icon = groupIcon;
      if (node.tag) item.tag = node.tag;
      if (node.expanded) item.expanded = true;
      out.push(item);
    } else {
      warnings.push({
        level: "warn",
        message: `Unsupported nav node in sidebar: ${JSON.stringify(node).slice(0, 60)}`,
      });
    }
  }
  return out;
}

function buildAnchors(config: DocsJson): ResolvedAnchor[] {
  const anchors = config.navigation.global?.anchors ?? [];
  return anchors
    .filter((a): a is typeof a & { href: string } => Boolean(a.href))
    .map((a) => {
      const out: ResolvedAnchor = {
        title: a.anchor,
        href: a.href,
      };
      if (typeof a.icon === "string") out.icon = a.icon;
      return out;
    });
}

function tabFromNavTab(
  tab: NavTab,
  ctx: ResolveOptions,
  warnings: ManifestWarning[],
  collectedSlugs: Set<string>,
): ResolvedTab {
  const slug = slugifyTab(tab.tab);
  const sidebarSlugs = new Set<string>();
  const sidebar: SidebarItem[] = [];

  if (Array.isArray(tab.pages)) {
    sidebar.push(...buildSidebar(tab.pages, ctx, warnings, sidebarSlugs));
  }
  if (Array.isArray(tab.groups)) {
    for (const g of tab.groups) {
      const children = buildSidebar(g.pages, ctx, warnings, sidebarSlugs);
      const item: SidebarItem = {
        title: g.group,
        slug: "",
        isGroup: true,
        children,
      };
      if (typeof g.icon === "string") item.icon = g.icon;
      if (g.tag) item.tag = g.tag;
      if (g.expanded) item.expanded = true;
      sidebar.push(item);
    }
  }

  for (const s of sidebarSlugs) collectedSlugs.add(s);

  const out: ResolvedTab = {
    slug,
    title: tab.tab,
    sidebar,
    pages: [...sidebarSlugs],
  };
  if (typeof tab.icon === "string") out.icon = tab.icon;
  if (tab.href) out.href = tab.href;
  if (tab.openapi) out.openapi = tab.openapi;
  return out;
}

function slugifyTab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveNavigation(opts: ResolveOptions): ResolveResult {
  const warnings: ManifestWarning[] = [];
  const navSlugs = new Set<string>();
  const tabs: ResolvedTab[] = [];
  const rootSidebar: SidebarItem[] = [];

  const nav = opts.config.navigation;

  if (Array.isArray(nav.tabs)) {
    for (const t of nav.tabs) {
      tabs.push(tabFromNavTab(t, opts, warnings, navSlugs));
    }
  }
  if (Array.isArray(nav.groups)) {
    const collected = new Set<string>();
    for (const g of nav.groups) {
      const children = buildSidebar(g.pages, opts, warnings, collected);
      const item: SidebarItem = {
        title: g.group,
        slug: "",
        isGroup: true,
        children,
      };
      if (typeof g.icon === "string") item.icon = g.icon;
      if (g.tag) item.tag = g.tag;
      if (g.expanded) item.expanded = true;
      rootSidebar.push(item);
    }
    for (const s of collected) navSlugs.add(s);
  }
  if (Array.isArray(nav.pages)) {
    const collected = new Set<string>();
    rootSidebar.push(...buildSidebar(nav.pages, opts, warnings, collected));
    for (const s of collected) navSlugs.add(s);
  }

  const navigation: ResolvedNavigation = {
    tabs,
    anchors: buildAnchors(opts.config),
    rootSidebar,
  };

  return { navigation, navSlugs: [...navSlugs], warnings };
}
