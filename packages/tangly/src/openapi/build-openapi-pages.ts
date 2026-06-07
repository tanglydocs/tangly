import type { DocsJson } from "@tanglydocs/schema";
import type { ManifestWarning, PageEntry, ResolvedTab, SidebarItem } from "../manifest/types.js";
import { expandOpenApiSpec, type ExpandedSpec, loadOpenApiSpec } from "./expand-spec.js";
import { resolveMethodColor } from "./method-color.js";

export interface OpenApiBuildResult {
  /** Synthesized PageEntry records (one per endpoint). */
  pages: PageEntry[];
  /** Tab-keyed sidebar additions: maps tab.slug → sidebar items to append. */
  sidebarsByTab: Record<string, SidebarItem[]>;
  warnings: ManifestWarning[];
}

/**
 * Walk navigation tabs and expand any attached OpenAPI specs into per-endpoint
 * pages. Two attachment points are supported, mirroring Mintlify:
 *
 *   - **tab-level** (`tab.openapi`): the whole tab is the spec; endpoints fill
 *     its (otherwise empty) sidebar.
 *   - **group-level** (`group.openapi`): a single group inside a tab carries a
 *     spec; endpoints nest under that group, alongside hand-authored groups.
 *
 * Both synthesize PageEntry records whose frontmatter carries
 * `openapi: METHOD path`; the runtime catch-all renders them via
 * OpenApiEndpoint just like a hand-authored page.
 */
export async function buildOpenApiPages(opts: {
  config: DocsJson;
  tabs: ResolvedTab[];
  root: string;
}): Promise<OpenApiBuildResult> {
  const pages: PageEntry[] = [];
  const sidebarsByTab: Record<string, SidebarItem[]> = {};
  const warnings: ManifestWarning[] = [];

  for (const tab of opts.tabs) {
    // Tab-level: top-level api.openapi falls under no tab and is skipped here —
    // auto-routes only attach when a tab opts in. Only auto-route when the tab
    // has no manually-curated sidebar; explicit groups/pages win.
    if (tab.openapi && tab.sidebar.length === 0) {
      // Mintlify object-form refs scope pages under `directory`; fall back to
      // the tab slug for the string/array forms.
      const prefix = tab.openapiDirectory ?? tab.slug;
      // eslint-disable-next-line no-await-in-loop -- per-tab sequential is intentional
      const expanded = await loadSpec(tab.openapi, prefix, tab.title, opts.root, warnings);
      if (expanded) {
        const sidebarItems = synthesizeSidebar(expanded);
        sidebarsByTab[tab.slug] = sidebarItems;
        pages.push(...synthesizePages(expanded, tab, tab.openapi, []));
      }
    }

    // Group-level: any group in this tab that declares its own spec and has no
    // hand-authored children. Endpoints nest under that group in place.
    for (const group of groupsWithSpec(tab.sidebar)) {
      const prefix = group.openapiDirectory ?? tab.slug;
      // eslint-disable-next-line no-await-in-loop -- per-group sequential is intentional
      const expanded = await loadSpec(group.openapi!, prefix, tab.title, opts.root, warnings);
      if (!expanded) continue;
      group.children = synthesizeSidebar(expanded);
      pages.push(...synthesizePages(expanded, tab, group.openapi!, [group.title]));
    }
  }

  return { pages, sidebarsByTab, warnings };
}

/** Load + expand a spec, filtering x-excluded ops. Returns null (with a warning) on miss/empty. */
async function loadSpec(
  source: string,
  prefix: string,
  label: string,
  root: string,
  warnings: ManifestWarning[],
): Promise<ExpandedSpec | null> {
  const spec = await loadOpenApiSpec(source, root);
  if (!spec) {
    warnings.push({ level: "warn", source, message: `Could not load OpenAPI spec for "${label}"` });
    return null;
  }
  const expanded = expandOpenApiSpec(spec, { prefix });
  // x-excluded: drop the operation entirely (no page, no sidebar entry).
  expanded.operations = expanded.operations.filter((o) => !o.op.excluded);
  if (expanded.operations.length === 0) {
    warnings.push({ level: "warn", message: `OpenAPI spec for "${label}" has no operations` });
    return null;
  }
  return expanded;
}

/** One PageEntry per endpoint. `extraCrumbs` adds breadcrumb levels (e.g. the owning group). */
function synthesizePages(
  expanded: ExpandedSpec,
  tab: ResolvedTab,
  source: string,
  extraCrumbs: string[],
): PageEntry[] {
  return expanded.operations.map((op) => ({
    slug: op.slug,
    file: `<openapi:${source}#${op.op.method}-${op.op.path}>`,
    frontmatter: {
      title: op.title,
      ...(op.op.description ? { description: op.op.description } : {}),
      openapi: `${op.op.method} ${op.op.path}`,
      ...(op.group ? { tag: op.group } : {}),
    },
    breadcrumbs: [
      { title: tab.title },
      ...extraCrumbs.map((title) => ({ title })),
      ...(op.group ? [{ title: op.group }] : []),
    ],
    // Wired to the tab's full sidebar by build-manifest once all specs resolve.
    sidebar: [],
    tab: { slug: tab.slug, title: tab.title },
    draft: false,
    ...(op.op.hidden && { hidden: true }),
  }));
}

/** Depth-first yield of group items that carry an `openapi` spec and no hand-authored children. */
function* groupsWithSpec(items: SidebarItem[]): Generator<SidebarItem> {
  for (const item of items) {
    if (item.isGroup && item.openapi && !(item.children && item.children.length > 0)) {
      yield item;
    } else if (item.children) {
      yield* groupsWithSpec(item.children);
    }
  }
}

function synthesizeSidebar(expanded: ExpandedSpec): SidebarItem[] {
  // Group operations by their first tag. Operations without tags fall into
  // an "API" group at the bottom. x-hidden ops are skipped here but still
  // get a PageEntry so direct URL navigation works.
  const groups = new Map<string, SidebarItem[]>();
  const orphan: SidebarItem[] = [];
  for (const op of expanded.operations) {
    if (op.op.hidden) continue;
    const item: SidebarItem = {
      title: op.title,
      slug: op.slug,
      isGroup: false,
      tag: op.op.method.toUpperCase(),
      methodColor: resolveMethodColor(op.op.method),
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
