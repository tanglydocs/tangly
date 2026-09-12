/**
 * Resolve the site-level JSON-LD inputs from `docs.json`.
 *
 * Shared by the head fragment (`Seo.astro`, which every theme's Layout
 * renders) and the redirect stub served at `/` when a project has no root
 * index page, so the Organization and WebSite nodes are byte-identical
 * wherever they appear. Divergence here is the one thing that breaks the
 * whole point of stable `@id`s.
 */
import type { DocsJson } from "@tanglydocs/schema";
import { type JsonLdSite, resolveOrganization } from "@tanglydocs/schema/json-ld";
import { resolveSite } from "@tanglydocs/schema/site";
import { withBase } from "./with-base.js";

export interface JsonLdContext {
  /** False when the site or the build has no structured data to emit. */
  enabled: boolean;
  /** Resolved site nodes input. Meaningless when `enabled` is false. */
  site: JsonLdSite;
  /** Canonical origin, no trailing slash. "" when none could be resolved. */
  canonicalBase: string;
  /** Absolute site root — canonical origin plus the deploy base. */
  siteRoot: string;
  /** Absolutize a root-relative path against the canonical origin. */
  absolutize: (path: string) => string;
}

export interface ResolveJsonLdContextInput {
  config: DocsJson;
  /** `Astro.url.origin`, passed only in dev. */
  devOrigin?: string;
}

export function resolveJsonLdContext(input: ResolveJsonLdContextInput): JsonLdContext {
  const { config } = input;

  const site = resolveSite({
    docsSiteUrl: (config as { siteUrl?: string }).siteUrl,
    env: process.env,
    ...(input.devOrigin ? { devOrigin: input.devOrigin } : {}),
  });
  const canonicalBase = site.canonicalUrl;

  const absolutize = (path: string): string => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!canonicalBase) return "";
    const local = path.startsWith("/") ? path : `/${path}`;
    return `${canonicalBase}${withBase(local)}`;
  };

  // Every `@id` hangs off the site root. A build with no resolvable origin
  // (no `siteUrl`, no platform env, not dev) emits nothing at all: a graph of
  // relative identifiers is worse than no graph.
  const siteRoot = canonicalBase ? `${canonicalBase}${withBase("/")}`.replace(/\/+$/, "") : "";

  const seo = config.seo as
    | {
        jsonld?: boolean;
        locale?: string;
        organization?: { name?: string; url?: string; logo?: string; sameAs?: string[] };
      }
    | undefined;

  const logo = config.logo;
  const logoLight = typeof logo === "string" ? logo : (logo?.light ?? logo?.dark);
  const rootSameAs = (config as { sameAs?: string[] }).sameAs;

  const organization = resolveOrganization({
    siteName: config.name,
    siteRoot,
    ...(seo?.organization ? { organization: seo.organization } : {}),
    ...(Array.isArray(rootSameAs) ? { sameAs: rootSameAs } : {}),
    ...(logoLight ? { logo: logoLight } : {}),
    absolutize,
  });

  return {
    enabled: seo?.jsonld !== false && Boolean(siteRoot),
    canonicalBase,
    siteRoot,
    absolutize,
    site: {
      siteRoot,
      name: config.name,
      ...(config.description ? { description: config.description } : {}),
      locale: seo?.locale ?? "en",
      organization,
      // Pagefind runs entirely in the browser, so there is no server-side
      // results route. The search modal deep-links off `?q=` on the home
      // route, which is what this target opens.
      ...(siteRoot ? { searchUrlTemplate: `${siteRoot}/?q={search_term_string}` } : {}),
    },
  };
}
