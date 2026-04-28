import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDocsJson } from "@tangly/schema";
import { resolveNavigation } from "./resolve-nav.js";
import { scanPages } from "./scan-pages.js";
import type { Manifest, ManifestWarning, PageEntry, SidebarItem } from "./types.js";

export interface BuildManifestOptions {
  /** Project root containing docs.json + mdx files. */
  root: string;
  /** Override docs.json filename (default "docs.json"). */
  configFile?: string;
}

export async function buildManifest(opts: BuildManifestOptions): Promise<Manifest> {
  const root = resolve(opts.root);
  const configPath = resolve(root, opts.configFile ?? "docs.json");

  const warnings: ManifestWarning[] = [];

  const raw = readFileSync(configPath, "utf8");
  const config = parseDocsJson(JSON.parse(raw));

  const diskPagesArr = await scanPages(root);
  const diskPages = new Map(diskPagesArr.map((p) => [p.slug, p]));

  for (const p of diskPagesArr) {
    if (p.frontmatterError) {
      warnings.push({
        level: "warn",
        source: p.file,
        message: `Frontmatter invalid: ${p.frontmatterError}`,
      });
    }
  }

  const {
    navigation,
    navSlugs,
    warnings: navWarnings,
  } = resolveNavigation({
    config,
    diskPages,
  });
  warnings.push(...navWarnings);

  const pages = new Map<string, PageEntry>();
  const navSlugSet = new Set(navSlugs);

  for (const slug of navSlugs) {
    const disk = diskPages.get(slug);
    if (!disk) {
      warnings.push({
        level: "warn",
        message: `Nav references "${slug}" but no MDX file found at "${slug}.mdx"`,
      });
      continue;
    }
    const fm = disk.frontmatter ?? {
      title: humanizeSlug(slug),
    };

    const tab = findTabForSlug(navigation, slug);
    const breadcrumbs = buildBreadcrumbs(navigation, slug, tab);
    const sidebar = pickSidebar(navigation, slug, tab);
    const { prev, next } = computePrevNext(sidebar, slug);

    pages.set(slug, {
      slug,
      file: disk.file,
      frontmatter: fm,
      breadcrumbs,
      sidebar,
      tab: tab ? { slug: tab.slug, title: tab.title } : undefined,
      prev,
      next,
      draft: Boolean(fm.draft),
    });
  }

  const orphans: string[] = [];
  for (const p of diskPagesArr) {
    if (!navSlugSet.has(p.slug)) orphans.push(p.slug);
  }

  return {
    config,
    pages,
    navigation,
    orphans,
    warnings,
    root,
  };
}

function humanizeSlug(slug: string): string {
  const last = slug.split("/").pop() ?? slug;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function findTabForSlug(
  nav: import("./types.js").ResolvedNavigation,
  slug: string,
): import("./types.js").ResolvedTab | undefined {
  return nav.tabs.find((t) => t.pages.includes(slug));
}

function pickSidebar(
  nav: import("./types.js").ResolvedNavigation,
  _slug: string,
  tab: import("./types.js").ResolvedTab | undefined,
): SidebarItem[] {
  if (tab) return tab.sidebar;
  return nav.rootSidebar;
}

function buildBreadcrumbs(
  _nav: import("./types.js").ResolvedNavigation,
  _slug: string,
  tab: import("./types.js").ResolvedTab | undefined,
): { title: string; slug?: string }[] {
  const crumbs: { title: string; slug?: string }[] = [];
  if (tab) {
    crumbs.push({ title: tab.title });
  }
  return crumbs;
}

function flattenSidebar(items: SidebarItem[]): SidebarItem[] {
  const flat: SidebarItem[] = [];
  for (const it of items) {
    if (it.children) flat.push(...flattenSidebar(it.children));
    else flat.push(it);
  }
  return flat;
}

function computePrevNext(
  sidebar: SidebarItem[],
  slug: string,
): { prev?: { slug: string; title: string }; next?: { slug: string; title: string } } {
  const flat = flattenSidebar(sidebar).filter((i) => !i.isGroup && i.slug);
  const idx = flat.findIndex((i) => i.slug === slug);
  if (idx < 0) return {};
  const prevItem = idx > 0 ? flat[idx - 1] : undefined;
  const nextItem = idx < flat.length - 1 ? flat[idx + 1] : undefined;
  return {
    prev: prevItem ? { slug: prevItem.slug, title: prevItem.title } : undefined,
    next: nextItem ? { slug: nextItem.slug, title: nextItem.title } : undefined,
  };
}
