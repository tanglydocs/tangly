import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { parseDocsJson } from "@tanglydocs/schema";
import { loadCollections, serializeCollections } from "../content/load-collections.js";
import { extractBlocks } from "../embed/extract-blocks.js";
import { buildOpenApiPages } from "../openapi/build-openapi-pages.js";
import { applyOpenApiOverride } from "../openapi/resolve-source.js";
import { resolveEditUrl } from "./git-meta.js";
import { resolveSite } from "../site/resolve-site.js";
import { resolveNavigation } from "./resolve-nav.js";
import { scanPages } from "./scan-pages.js";
import { resolveSectionDefaults } from "./section-defaults.js";
import type { Manifest, ManifestWarning, PageEntry, SidebarItem } from "./types.js";

export interface BuildManifestOptions {
  /** Project root containing docs.json + mdx files. */
  root: string;
  /** Override docs.json filename (default "docs.json"). */
  configFile?: string;
  /**
   * If true, draft pages are kept in `pages` and reachable from sidebars
   * with a "Draft" badge. If false (default in build mode), draft pages are
   * dropped entirely. Dev mode passes `true`.
   */
  includeDrafts?: boolean;
}

export async function buildManifest(opts: BuildManifestOptions): Promise<Manifest> {
  const root = resolve(opts.root);
  const configPath = resolve(root, opts.configFile ?? "docs.json");

  const warnings: ManifestWarning[] = [];

  const raw = readFileSync(configPath, "utf8");
  const config = parseDocsJson(JSON.parse(raw));

  // Social cards need an absolute base (og:image must be absolute). If cards
  // are enabled but no base resolves (no siteUrl, --site-url, or platform), no
  // cards are emitted at build — surface that via `tangly check`. Skip in dev,
  // where cards render live against the request origin.
  const thumbnails = config.thumbnails as { enabled?: boolean; image?: string } | undefined;
  const cardsEnabled = thumbnails?.enabled !== false && !thumbnails?.image;
  const isDev = process.env.TANGLY_MODE === "dev";
  if (
    cardsEnabled &&
    !isDev &&
    !resolveSite({ docsSiteUrl: config.siteUrl, env: process.env }).ogUrl
  ) {
    warnings.push({
      level: "warn",
      source: opts.configFile ?? "docs.json",
      message:
        "Social cards are enabled but no site URL is set. Open Graph images need an absolute URL — set `siteUrl` in docs.json (or pass --site-url / TANGLY_SITE_URL). Set `thumbnails.enabled: false` to silence this.",
    });
  }

  const diskPagesArr = await scanPages(root);
  const diskPages = new Map(diskPagesArr.map((p) => [p.slug, p]));

  for (const p of diskPagesArr) {
    if (p.frontmatterError) {
      // Pretty-format Zod errors when available; fall back to raw text.
      let prettyMessage = `Frontmatter invalid: ${p.frontmatterError}`;
      const zodError = p.frontmatterZodError;
      if (zodError) {
        const { formatFrontmatterError } = await import("./frontmatter-errors.js");
        prettyMessage = formatFrontmatterError({ file: p.file, error: zodError });
      }
      warnings.push({
        level: "warn",
        source: p.file,
        message: prettyMessage,
      });
    }
  }

  const {
    navigation,
    navSlugs,
    navTemplates,
    warnings: navWarnings,
  } = resolveNavigation({
    config,
    diskPages,
  });
  warnings.push(...navWarnings);

  const pages = new Map<string, PageEntry>();
  const navSlugSet = new Set(navSlugs);

  const includeDrafts = opts.includeDrafts ?? false;

  // Footer config drives last-updated + edit-on-source. We cache the
  // resolved editUrl per page so PageShell can render a one-click link
  // without redoing remote-URL parsing on every render.
  const footer = config.footer as
    | { lastUpdated?: boolean; editUrl?: string; repo?: string }
    | undefined;
  const editUrlTemplate = footer?.editUrl;
  const repo = footer?.repo;

  for (const slug of navSlugs) {
    const disk = diskPages.get(slug);
    if (!disk) {
      warnings.push({
        level: "warn",
        message: `Nav references "${slug}" but no MDX file found at "${slug}.mdx"`,
      });
      continue;
    }
    // Cascade section defaults: outer _section.mdx / _meta.json provide
    // inheritable fields; page frontmatter overrides them. Nav-level
    // `template` (on a group/tab) sits at the bottom of the cascade.
    const sectionDefaults = resolveSectionDefaults(disk.file, root);
    const baseFm = disk.frontmatter ?? { title: humanizeSlug(slug) };
    const navTemplate = navTemplates.get(slug);
    const fm = {
      ...(navTemplate ? { template: navTemplate } : {}),
      ...sectionDefaults,
      ...baseFm,
    };
    const isDraft = Boolean(fm.draft);

    if (isDraft && !includeDrafts) {
      // Skip drafts entirely in production build mode.
      continue;
    }

    const tab = findTabForSlug(navigation, slug);
    const breadcrumbs = buildBreadcrumbs(navigation, slug, tab);
    const sidebar = pickSidebar(navigation, slug, tab);
    const { prev, next } = computePrevNext(sidebar, slug);

    // Extract block IDs from the MDX body so <Embed page="..." block="..." />
    // can resolve targets at SSR time.
    const blocks = extractBlocks(disk.content).blocks;

    // Resolve last-updated: page frontmatter wins, falls back to git.
    let lastUpdated: string | undefined;
    const fmLast = fm.lastUpdated;
    if (typeof fmLast === "string") {
      lastUpdated = fmLast;
    } else if (fmLast === false) {
      lastUpdated = undefined;
    } else {
      lastUpdated = disk.lastUpdated;
    }

    // Reading time: page frontmatter wins.
    let readingTime: number | undefined;
    const fmRead = fm.readingTime;
    if (typeof fmRead === "number") {
      readingTime = fmRead;
    } else if (fmRead === false) {
      readingTime = undefined;
    } else {
      readingTime = disk.readingTime;
    }

    // editUrl: per-page frontmatter override, then config template/repo.
    const pageRel = relative(root, disk.file).split(sep).join("/");
    const editUrl =
      typeof fm.editUrl === "string"
        ? fm.editUrl
        : (resolveEditUrl({
            root,
            pagePathRelative: pageRel,
            ...(editUrlTemplate ? { editUrlTemplate } : {}),
            ...(repo ? { repo } : {}),
          }) ?? undefined);

    pages.set(slug, {
      slug,
      file: disk.file,
      frontmatter: fm,
      breadcrumbs,
      sidebar,
      tab: tab ? { slug: tab.slug, title: tab.title } : undefined,
      prev,
      next,
      draft: isDraft,
      ...(lastUpdated ? { lastUpdated } : {}),
      ...(typeof readingTime === "number" ? { readingTime } : {}),
      ...(editUrl ? { editUrl } : {}),
      ...(Object.keys(blocks).length > 0 ? { blocks } : {}),
    });
  }

  const orphans: string[] = [];
  for (const p of diskPagesArr) {
    if (!navSlugSet.has(p.slug)) {
      orphans.push(p.slug);
      // Orphan pages are still routable (the catch-all walks the whole
      // content collection). Surface a minimal PageEntry so <Embed> can
      // resolve them as sources.
      if (p.frontmatter?.draft && !includeDrafts) continue;
      const fm = p.frontmatter ?? { title: humanizeSlug(p.slug) };
      const blocks = extractBlocks(p.content).blocks;
      pages.set(p.slug, {
        slug: p.slug,
        file: p.file,
        frontmatter: fm,
        breadcrumbs: [],
        sidebar: navigation.rootSidebar,
        draft: Boolean(p.frontmatter?.draft),
        ...(Object.keys(blocks).length > 0 ? { blocks } : {}),
      });
    }
  }

  // Phase 3: expand OpenAPI specs attached to tabs into per-endpoint pages.
  // Each endpoint becomes a synthesized PageEntry whose frontmatter carries
  // `openapi: METHOD path`; the runtime catch-all renders them via
  // OpenApiEndpoint just like a hand-authored page.
  try {
    applyOpenApiOverride(config, navigation.tabs);
    const openapi = await buildOpenApiPages({
      config,
      tabs: navigation.tabs,
      root,
    });
    for (const synth of openapi.pages) {
      pages.set(synth.slug, synth);
    }
    // Attach the synthesized sidebar to each tab in-place. Endpoint pages
    // share the same per-tab sidebar.
    for (const tab of navigation.tabs) {
      const additions = openapi.sidebarsByTab[tab.slug];
      if (additions && additions.length > 0) {
        tab.sidebar.push(...additions);
        for (const synth of openapi.pages.filter((p) => p.tab?.slug === tab.slug)) {
          synth.sidebar = tab.sidebar;
          tab.pages.push(synth.slug);
        }
      }
    }
    warnings.push(...openapi.warnings);
  } catch (err) {
    warnings.push({
      level: "warn",
      message: `OpenAPI expansion failed: ${(err as Error).message}`,
    });
  }

  // Load user-defined content collections from tangly.config.ts (if present).
  let collections: Manifest["collections"];
  try {
    const loaded = await loadCollections(root);
    if (Object.keys(loaded.data).length > 0) {
      collections = serializeCollections(loaded.data);
    }
    for (const e of loaded.errors) {
      warnings.push({
        level: "error",
        source: e.file,
        message: `Collection "${e.collection}" validation failed: ${e.message}`,
      });
    }
  } catch (err) {
    warnings.push({
      level: "warn",
      message: `Could not load tangly.config.ts collections: ${(err as Error).message}`,
    });
  }

  return {
    config,
    pages,
    navigation,
    orphans,
    warnings,
    root,
    ...(collections ? { collections } : {}),
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
