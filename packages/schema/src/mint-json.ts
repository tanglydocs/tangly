import type { DocsJson } from "./docs-json.js";
import type { NavGroup, NavTab } from "./navigation.js";

export interface MintJson {
  name?: string;
  description?: string;
  logo?: string | { light?: string; dark?: string; href?: string };
  favicon?: string;
  colors?: {
    primary?: string;
    light?: string;
    dark?: string;
    background?: { light?: string; dark?: string };
    anchors?: { from?: string; to?: string };
  };
  topbarLinks?: Array<{ name: string; url: string }>;
  topbarCtaButton?: { name?: string; url?: string; type?: string };
  navigation?: Array<{
    group: string;
    pages: unknown[];
    icon?: string;
  }>;
  tabs?: Array<{ name: string; url?: string; icon?: string }>;
  anchors?: Array<{ name: string; url?: string; icon?: string }>;
  footerSocials?: Record<string, string>;
  api?: {
    baseUrl?: string;
    auth?: { method?: string; name?: string };
    playground?: { mode?: string };
  };
  openapi?: string | string[];
  feedback?: { thumbsRating?: boolean; suggestEdits?: boolean };
  search?: { prompt?: string };
  metadata?: Record<string, string>;
  modeToggle?: { default?: string; isHidden?: boolean };
  analytics?: Record<string, unknown>;
  redirects?: Array<{ source: string; destination: string; permanent?: boolean }>;
  primaryTab?: { name: string };
  $schema?: string;
  [key: string]: unknown;
}

function migrateGroups(mint: MintJson): NavGroup[] {
  if (!Array.isArray(mint.navigation)) return [];
  return mint.navigation.map(
    (g): NavGroup => ({
      group: g.group,
      icon: g.icon,
      pages: g.pages as NavGroup["pages"],
    }),
  );
}

export function convertMintToDocs(mint: MintJson): DocsJson {
  const navigation: DocsJson["navigation"] = {};

  if (Array.isArray(mint.tabs) && mint.tabs.length > 0) {
    const groups = migrateGroups(mint);
    const tabs: NavTab[] = mint.tabs.map((tab) => {
      const t: NavTab = {
        tab: tab.name,
        icon: tab.icon,
        href: tab.url,
      };
      if (!tab.url && groups.length > 0) {
        t.groups = groups;
      }
      return t;
    });
    navigation.tabs = tabs;
  } else {
    const groups = migrateGroups(mint);
    if (groups.length > 0) navigation.groups = groups;
  }

  if (Array.isArray(mint.anchors) && mint.anchors.length > 0) {
    navigation.global = {
      anchors: mint.anchors.map((a) => ({
        anchor: a.name,
        icon: a.icon,
        href: a.url,
      })),
    };
  }

  const docs: DocsJson = {
    $schema: "https://tangly.dev/schema/docs.json",
    name: mint.name ?? "Untitled",
    description: mint.description,
    theme: "tang",
    colors: mint.colors,
    logo: mint.logo,
    favicon: mint.favicon,
    navigation,
    redirects: mint.redirects,
    metadata: mint.metadata,
    search: mint.search,
    analytics: mint.analytics as DocsJson["analytics"],
  };

  const apiAny = mint.api as { baseUrl?: string; auth?: unknown; playground?: unknown } | undefined;
  if (apiAny || mint.openapi) {
    docs.api = {
      ...(apiAny?.baseUrl ? { baseUrl: apiAny.baseUrl } : {}),
      ...(apiAny?.auth ? { auth: apiAny.auth as NonNullable<DocsJson["api"]>["auth"] } : {}),
      ...(apiAny?.playground
        ? { playground: apiAny.playground as NonNullable<DocsJson["api"]>["playground"] }
        : {}),
      ...(mint.openapi ? { openapi: mint.openapi } : {}),
    };
  }

  if (mint.topbarLinks || mint.topbarCtaButton) {
    docs.navbar = {
      links: mint.topbarLinks?.map((l) => ({ label: l.name, href: l.url })),
      primary:
        mint.topbarCtaButton?.name && mint.topbarCtaButton.url
          ? {
              type: "button",
              label: mint.topbarCtaButton.name,
              href: mint.topbarCtaButton.url,
            }
          : undefined,
    };
  }

  if (mint.footerSocials) {
    docs.footer = { socials: mint.footerSocials };
  }

  return docs;
}
