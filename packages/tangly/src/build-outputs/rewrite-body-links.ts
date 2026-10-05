import { pageRouteForSlug } from "@tanglydocs/schema";
import type { Manifest } from "../manifest/index.js";

/**
 * Every served in-site route (no base prefix), used to allowlist which
 * `/path` targets in a raw MDX/Markdown body are actually pages — as
 * opposed to literal API endpoints (`/api/v1/domains`) that happen to look
 * like a root-relative path inside a code sample or prose link. Draft pages
 * are excluded: they never ship a route to link to.
 */
export function collectPageRoutes(manifest: Manifest): Set<string> {
  const routes = new Set<string>();
  for (const page of manifest.pages.values()) {
    if (page.draft) continue;
    routes.add(pageRouteForSlug(page.slug));
  }
  return routes;
}

/**
 * Prefix internal link targets in a raw page body with `base`, so the
 * agent-facing outputs (`<slug>.md`, `llms-full.txt`) match the base path
 * already applied to the rendered HTML, the sitemap, canonical tags, and
 * `llms.txt`. `generateLlmsFullTxt`/`writePageMarkdown` push the source MDX
 * straight through (frontmatter + body, unrendered), so this runs as a
 * plain string rewrite over the two link forms that source actually
 * contains: Markdown `](/path)` and JSX `href="/path"`.
 *
 * `pageRoutes` allowlists the rewrite to known pages (see
 * `collectPageRoutes`) — a blind `/` → `/docs/` prefix would also mangle
 * literal API paths (`/api/v1/domains`) that aren't site pages at all.
 * Already-prefixed, external, protocol-relative, and anchor-only targets
 * are left alone, so re-running (or a page that already wrote its own
 * absolute links) is a no-op.
 */
export function rewriteBodyLinks(body: string, base: string, pageRoutes: Set<string>): string {
  if (!base) return body;

  const prefix = (path: string): string | null => {
    if (!path.startsWith("/") || path.startsWith("//")) return null;
    if (path === base || path.startsWith(`${base}/`)) return null;
    const pathname = path.split(/[#?]/)[0] ?? "";
    const route = pathname.replace(/\/+$/, "") || "/";
    if (!pageRoutes.has(route)) return null;
    return `${base}${path}`;
  };

  return body
    .replace(/\]\((\/[^)\s]*)\)/g, (match, path: string) => {
      const next = prefix(path);
      return next === null ? match : `](${next})`;
    })
    .replace(/href="(\/[^"]*)"/g, (match, path: string) => {
      const next = prefix(path);
      return next === null ? match : `href="${next}"`;
    });
}
