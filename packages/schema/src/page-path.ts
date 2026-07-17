/**
 * Map a page slug to the route it is actually served at.
 *
 * Slugs come from the source file path, and `index` files are special: a
 * nested `cli/index.mdx` already collapses to `cli` during the page scan, but
 * a root `index.mdx` slugifies to the bare string `index` (the collapse regex
 * needs a leading `/`). That page renders at `/` and is only *also* routable
 * at `/index`, which redirects. Anything published as a URL — canonical tags,
 * sitemap entries, llms.txt links — must use the served route, or search
 * engines see a redirecting duplicate.
 *
 * Lives in `@tanglydocs/schema` (the shared leaf both `tangly` and the themes
 * depend on) so theme components can resolve routes without importing `tangly`
 * — keeping the package graph acyclic. Same rationale as `resolve-site`.
 */

/** Route for a page slug, leading slash, no trailing slash. Home → "/". */
export function pageRouteForSlug(slug: string): string {
  // The trailing-`/index` collapse duplicates what `scanPages` already does to
  // nested slugs; kept here so any caller holding a raw file-derived slug
  // resolves the same route.
  const trimmed = slug.replace(/^\/+|\/+$/g, "").replace(/(^|\/)index$/, "");
  if (trimmed === "") return "/";
  return `/${trimmed}`;
}

/**
 * Public URL path for a page slug under a deploy `base` (e.g. "/docs").
 * `base` is expected pre-normalized: "" for root, "/docs" otherwise.
 */
export function pagePathForSlug(slug: string, base = ""): string {
  return `${base}${pageRouteForSlug(slug)}`.replace(/\/+$/, "") || "/";
}
