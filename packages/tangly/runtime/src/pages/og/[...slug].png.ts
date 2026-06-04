/**
 * Open Graph / social card endpoint. Emits one 1200x630 PNG per indexable docs
 * page. Under `output: "static"` Astro prerenders these to `dist/og/<slug>.png`
 * at build; under `tangly dev` the same route renders on demand (live preview,
 * no stale cache). The layout's <Seo> points og:image at `/og/<slug>.png`.
 */

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { manifest } from "virtual:tangly/manifest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listRoutablePages, toOgPage, type OgPage } from "../../lib/og-pages.ts";
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
  if (import.meta.env.PROD && !manifest.config.siteUrl) return [];

  const entries = await getCollection("docs");
  const pageMap = new Map(manifest.pages);
  const cards = listRoutablePages(entries, manifest.pages, manifest.excludedSlugs)
    .map((p) => toOgPage(p, pageMap))
    .filter((p): p is OgPage => p !== null);

  // Home page (slug "") maps to /og/index.png.
  return cards.map((card) => ({
    params: { slug: card.slug || "index" },
    props: { card },
  }));
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
