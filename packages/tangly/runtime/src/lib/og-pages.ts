/**
 * Single source of truth for "which pages get a route". Both the docs catch-all
 * (`[...slug].astro`) and the OG card endpoint (`og/[...slug].png.ts`) build
 * their `getStaticPaths` from `listRoutablePages` so the two route lists can
 * never drift — a card is only ever emitted for a page that actually exists.
 *
 * Pure module: no Astro/virtual imports. Callers pass the collection entries
 * and the manifest payload in.
 */

import type { PageEntry } from "tangly";

/** Minimal shape of an `astro:content` docs entry we rely on. */
export interface DocEntryLike {
  id: string;
  data: { title?: string; description?: string; noindex?: boolean };
}

export interface RoutablePage {
  slug: string;
  entry: DocEntryLike | null;
  synthPage: PageEntry | null;
}

/**
 * Mirror of the original `[...slug].astro` enumeration: every MDX entry (minus
 * excluded drafts) plus every synthesized OpenAPI page not already covered by
 * an MDX entry.
 */
export function listRoutablePages(
  entries: DocEntryLike[],
  manifestPages: Array<[string, PageEntry]>,
  excludedSlugs: string[] | undefined,
): RoutablePage[] {
  const excluded = new Set(excludedSlugs ?? []);
  const entrySlugs = new Set(entries.map((e) => e.id));

  const mdx: RoutablePage[] = entries
    .filter((entry) => !excluded.has(entry.id))
    .map((entry) => ({ slug: entry.id, entry, synthPage: null }));

  const synth: RoutablePage[] = manifestPages
    .filter(([slug]) => !entrySlugs.has(slug) && !excluded.has(slug))
    .map(([slug, page]) => ({ slug, entry: null, synthPage: page }));

  return [...mdx, ...synth];
}

export interface OgPage {
  /** Route slug ("" for the home page). */
  slug: string;
  title: string;
  description?: string;
  /** Uppercase label above the title — the owning tab's name. */
  eyebrow?: string;
}

function humanizeSlug(slug: string): string {
  const last = slug.split("/").pop() ?? slug;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve a routable page into card content, or `null` if it should not get a
 * card (`noindex` pages render HTML but advertise no social image).
 */
export function toOgPage(
  page: RoutablePage,
  manifestPageMap: Map<string, PageEntry>,
): OgPage | null {
  const meta = manifestPageMap.get(page.slug);
  const fm = meta?.frontmatter ?? page.synthPage?.frontmatter;

  const noindex = page.entry?.data?.noindex ?? fm?.noindex ?? false;
  if (noindex) return null;

  const title =
    page.entry?.data?.title ??
    fm?.title ??
    page.synthPage?.frontmatter?.title ??
    humanizeSlug(page.slug);
  const description =
    page.entry?.data?.description ?? fm?.description ?? page.synthPage?.frontmatter?.description;
  const eyebrow = meta?.tab?.title ?? page.synthPage?.tab?.title;

  return { slug: page.slug, title, description, eyebrow };
}
