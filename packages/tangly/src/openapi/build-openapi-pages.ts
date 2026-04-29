import type { DocsJson } from "@tanglydocs/schema";
import type { ManifestWarning, PageEntry, ResolvedTab, SidebarItem } from "../manifest/types.js";
import { expandOpenApiSpec, loadOpenApiSpec, type ExpandedSpec } from "./expand-spec.js";

export interface OpenApiBuildResult {
  /** Synthesized PageEntry records (one per endpoint). */
  pages: PageEntry[];
  /** Tab-keyed sidebar additions: maps tab.slug → sidebar items to append. */
  sidebarsByTab: Record<string, SidebarItem[]>;
  warnings: ManifestWarning[];
}

/**
 * Walk navigation tabs, find ones with `openapi` set, fetch + expand each
 * spec into per-endpoint pages, and synthesize PageEntry + SidebarItem
 * additions for the manifest.
 */
export async function buildOpenApiPages(opts: {
  config: DocsJson;
  tabs: ResolvedTab[];
  root: string;
}): Promise<OpenApiBuildResult> {
  const pages: PageEntry[] = [];
  const sidebarsByTab: Record<string, SidebarItem[]> = {};
  const warnings: ManifestWarning[] = [];

  // Collect (tab, openapi) pairs. Top-level api.openapi falls under no tab
  // and is skipped here — auto-routes only attach when a tab opts in.
  for (const tab of opts.tabs) {
    if (!tab.openapi) continue;
    // Only auto-route when the tab has no manually-curated sidebar. If the
    // user already wrote explicit `groups`/`pages` in docs.json, those win
    // and we don't synthesize duplicates.
    if (tab.sidebar.length > 0) continue;
    // eslint-disable-next-line no-await-in-loop -- per-tab sequential is intentional
    const spec = await loadOpenApiSpec(tab.openapi, opts.root);
    if (!spec) {
      warnings.push({
        level: "warn",
        source: tab.openapi,
        message: `Could not load OpenAPI spec for tab "${tab.title}"`,
      });
      continue;
    }
    const expanded = expandOpenApiSpec(spec, { prefix: tab.slug });
    if (expanded.operations.length === 0) {
      warnings.push({
        level: "warn",
        message: `OpenAPI spec for tab "${tab.title}" has no operations`,
      });
      continue;
    }

    const sidebarItems = synthesizeSidebar(expanded, tab.slug);
    sidebarsByTab[tab.slug] = sidebarItems;

    for (const op of expanded.operations) {
      const sidebar = [...(sidebarsByTab[tab.slug] ?? [])];
      pages.push({
        slug: op.slug,
        file: `<openapi:${tab.openapi}#${op.op.method}-${op.op.path}>`,
        frontmatter: {
          title: op.title,
          ...(op.op.description ? { description: op.op.description } : {}),
          openapi: `${op.op.method} ${op.op.path}`,
          ...(op.group ? { tag: op.group } : {}),
        },
        breadcrumbs: [{ title: tab.title }, ...(op.group ? [{ title: op.group }] : [])],
        sidebar,
        tab: { slug: tab.slug, title: tab.title },
        draft: false,
      });
    }
  }

  return { pages, sidebarsByTab, warnings };
}

function synthesizeSidebar(expanded: ExpandedSpec, _tabSlug: string): SidebarItem[] {
  // Group operations by their first tag. Operations without tags fall into
  // an "API" group at the bottom.
  const groups = new Map<string, SidebarItem[]>();
  const orphan: SidebarItem[] = [];
  for (const op of expanded.operations) {
    const item: SidebarItem = {
      title: op.title,
      slug: op.slug,
      isGroup: false,
      tag: methodBadge(op.op.method),
    };
    if (op.group) {
      const arr = groups.get(op.group) ?? [];
      arr.push(item);
      groups.set(op.group, arr);
    } else {
      orphan.push(item);
    }
  }

  const sidebar: SidebarItem[] = [];
  for (const [group, children] of groups.entries()) {
    sidebar.push({
      title: group,
      slug: "",
      isGroup: true,
      expanded: true,
      children,
    });
  }
  if (orphan.length > 0) {
    sidebar.push({
      title: "Other",
      slug: "",
      isGroup: true,
      expanded: true,
      children: orphan,
    });
  }
  return sidebar;
}

function methodBadge(method: string): string {
  return method.toUpperCase();
}
