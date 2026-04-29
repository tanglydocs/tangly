import type { DocsJson, Frontmatter, NavGroup, NavTab } from "@tangly/schema";

export interface SidebarItem {
  /** Display title for the sidebar. */
  title: string;
  /** Slug (no extension). Empty string for category headers. */
  slug: string;
  /** True if this entry is a folder/group, not a navigable page. */
  isGroup: boolean;
  /** Optional icon name. */
  icon?: string;
  /** Optional tag (e.g. "Beta"). */
  tag?: string;
  /** Whether the group is initially expanded. */
  expanded?: boolean;
  /** Children (for groups). */
  children?: SidebarItem[];
}

export interface PageEntry {
  /** Slug used as the route — e.g. "guides/networks". */
  slug: string;
  /** Absolute path to the .mdx file on disk. */
  file: string;
  /** Validated frontmatter. */
  frontmatter: Frontmatter;
  /** Breadcrumb trail. */
  breadcrumbs: { title: string; slug?: string }[];
  /** Sidebar tree relevant to the page (already trimmed to this tab/version). */
  sidebar: SidebarItem[];
  /** Tab this page belongs to (if any). */
  tab?: { slug: string; title: string };
  /** Previous page (or null). */
  prev?: { slug: string; title: string };
  /** Next page (or null). */
  next?: { slug: string; title: string };
  /** Whether this page is a draft (hidden in build). */
  draft: boolean;
  /** ISO timestamp of last git commit touching this file. */
  lastUpdated?: string;
  /** Auto-computed reading time in minutes. */
  readingTime?: number;
  /** Resolved edit-on-source URL for this page. */
  editUrl?: string;
  /**
   * Block IDs harvested from this page's MDX body — keys are the auto- or
   * explicitly-set anchor IDs, values are the raw MDX source for that
   * block. Populated lazily; absent for synth pages and orphans.
   */
  blocks?: Record<string, string>;
}

export interface ResolvedTab {
  slug: string;
  title: string;
  icon?: string;
  /** External href (renders as a link, no children). */
  href?: string;
  /** Top-level openapi spec URL/path. */
  openapi?: string;
  /** Sidebar for this tab. */
  sidebar: SidebarItem[];
  /** Pages reachable in this tab. */
  pages: string[];
}

export interface ResolvedAnchor {
  title: string;
  icon?: string;
  href: string;
}

export interface ResolvedNavigation {
  tabs: ResolvedTab[];
  anchors: ResolvedAnchor[];
  /** Pages outside any tab (root-level groups/pages). */
  rootSidebar: SidebarItem[];
}

export interface ManifestWarning {
  level: "warn" | "error";
  message: string;
  source?: string;
}

export interface Manifest {
  config: DocsJson;
  pages: Map<string, PageEntry>;
  navigation: ResolvedNavigation;
  /** MDX files on disk that are not referenced in nav. */
  orphans: string[];
  warnings: ManifestWarning[];
  /** Source root directory. */
  root: string;
  /** User-defined content collections (validated against Zod schemas). */
  collections?: Record<string, Array<{ slug: string; file: string; data: unknown; body: string }>>;
}

export type { NavGroup, NavTab };
