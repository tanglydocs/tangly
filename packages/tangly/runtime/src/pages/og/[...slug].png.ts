/**
 * Open Graph / social card endpoint. Emits one 1200x630 PNG per indexable docs
 * page. Under `output: "static"` Astro prerenders these to `dist/og/<slug>.png`
 * at build; under `tangly dev` the same route renders on demand (live preview,
 * no stale cache). The layout's <Seo> points og:image at `/og/<slug>.png`.
 */

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { manifest } from "virtual:tangly/manifest";
import type { PageEntry } from "tangly";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { resolveSite } from "tangly/site";
import {
  apiAttrOf,
  hasExplicitTitle,
  listRoutablePages,
  operationMeta,
  parseApiAttr,
  toOgPage,
  type OgPage,
  type RoutablePage,
} from "../../lib/og-pages.ts";
import { renderOgPng } from "../../lib/og-render.ts";

export const prerender = true;

export async function getStaticPaths() {
  // Generation is off when disabled, or when a single static image is set for
  // the whole site (that opts out of per-page cards). At build, skip when no
  // siteUrl exists since nothing would reference the PNGs; dev always renders
  // so cards can be previewed on demand.
  const thumbnails = manifest.config.thumbnails;
  const generationEnabled = thumbnails?.enabled !== false && !thumbnails?.image;
  if (!generationEnabled) return [];
  // At build, skip when no absolute base is resolvable (env override, platform,
  // or docs.json siteUrl) — nothing would reference the PNGs. Dev always renders.
  if (import.meta.env.PROD) {
    const site = resolveSite({ docsSiteUrl: manifest.config.siteUrl, env: process.env });
    if (!site.ogUrl) return [];
  }

  const entries = await getCollection("docs");
  const pageMap = new Map(manifest.pages);

  interface CardItem {
    page: RoutablePage;
    meta: PageEntry | undefined;
    og: OgPage;
  }
  const items = listRoutablePages(entries, manifest.pages, manifest.excludedSlugs)
    .map((page) => ({ page, meta: pageMap.get(page.slug), og: toOgPage(page, pageMap) }))
    .filter((x): x is CardItem => x.og !== null);

  await enrichApiCards(items);

  // Home page (slug "") maps to /og/index.png.
  return items.map(({ og }) => ({
    params: { slug: og.slug || "index" },
    props: { card: og },
  }));
}

/**
 * API pages without an explicit title fall back to the humanized slug in
 * `toOgPage`, whereas the HTML route (`[...slug].astro`) derives the title and
 * description from the OpenAPI operation. Mirror that derivation so the card
 * text matches the rendered page header. Best-effort: each spec is fetched at
 * most once, and any failure leaves the slug fallback in place.
 */
async function enrichApiCards(
  items: Array<{ page: RoutablePage; meta: PageEntry | undefined; og: OgPage }>,
): Promise<void> {
  const apiCfg = manifest.config.api;
  const topSpec =
    typeof apiCfg?.openapi === "string"
      ? apiCfg.openapi
      : Array.isArray(apiCfg?.openapi)
        ? apiCfg.openapi[0]
        : undefined;
  const specCache = new Map<string, Promise<unknown | null>>();

  await Promise.all(
    items.map(async ({ page, meta, og }) => {
      // Mirror [...slug].astro, which derives title and description
      // independently: title only when no explicit title exists, description
      // only when no explicit description exists.
      const titleIsFallback = !hasExplicitTitle(page, meta);
      const descMissing = og.description === undefined;
      if (!titleIsFallback && !descMissing) return;
      const coords = parseApiAttr(apiAttrOf(page, meta));
      if (!coords) return;
      const tabSlug = meta?.tab?.slug ?? page.synthPage?.tab?.slug;
      const spec = manifest.navigation.tabs.find((t) => t.slug === tabSlug)?.openapi ?? topSpec;
      if (!spec) return;
      const doc = await fetchSpec(spec, specCache);
      if (!doc) return;
      const op = operationMeta(doc, coords.method, coords.path);
      if (titleIsFallback && op.title) og.title = op.title;
      if (descMissing && op.description) og.description = op.description;
    }),
  );
}

function fetchSpec(
  spec: string,
  cache: Map<string, Promise<unknown | null>>,
): Promise<unknown | null> {
  let pending = cache.get(spec);
  if (!pending) {
    const url = spec.startsWith("http") ? spec : `https://${spec}`;
    pending = fetch(url, { redirect: "follow" })
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .catch(() => null);
    cache.set(spec, pending);
  }
  return pending;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  gif: "image/gif",
};

// Embed the project logo (if a readable local raster/SVG) as a data URI once.
// `undefined` = not yet computed; `null` = computed, none available.
let logoDataUri: string | null | undefined;
function resolveLogoDataUri(): string | undefined {
  if (logoDataUri !== undefined) return logoDataUri ?? undefined;
  logoDataUri = null;
  const logo = manifest.config.logo;
  const rel = typeof logo === "string" ? logo : (logo?.light ?? logo?.dark);
  if (!rel || rel.startsWith("http")) return undefined;
  const clean = rel.replace(/^\//, "");
  const ext = (clean.split(".").pop() ?? "").toLowerCase();
  const mime = MIME[ext];
  if (!mime) return undefined;
  // Best-effort: a missing/unreadable logo must never throw (this runs outside
  // renderOgPng's catch and would 500 the prerender).
  try {
    for (const candidate of [
      resolve(manifest.root, clean),
      resolve(manifest.root, "public", clean),
    ]) {
      // Containment: a `logo` like `../secret.png` resolves outside the docs
      // root. Never read (let alone embed) a file that escapes the project.
      const relToRoot = relative(manifest.root, candidate);
      if (relToRoot.startsWith("..") || isAbsolute(relToRoot)) continue;
      if (existsSync(candidate)) {
        logoDataUri = `data:${mime};base64,${readFileSync(candidate).toString("base64")}`;
        return logoDataUri;
      }
    }
  } catch {
    // fall through — render the card without a logo
  }
  return undefined;
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: OgPage };
  const png = await renderOgPng(
    {
      title: card.title,
      description: card.description,
      eyebrow: card.eyebrow,
      siteName: manifest.config.name,
      logoDataUri: resolveLogoDataUri(),
    },
    manifest.config,
  );
  if (!png) return new Response("Not found", { status: 404 });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
