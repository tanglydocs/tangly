/**
 * Prepend Astro's configured base to a root-relative URL.
 *
 * Usage in .astro files:
 *   import { withBase } from "@tanglydocs/theme-ui/with-base";
 *   <a href={withBase(href)} />
 *
 * No-op for external URLs, anchors, and already-prefixed paths.
 */
export function withBase(href: string | undefined | null): string | undefined {
  if (!href) return href ?? undefined;
  // External / protocol-relative / mailto / tel / anchor / non-absolute
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("http://") ||
    href.startsWith("https://")
  ) {
    return href;
  }
  let base = import.meta.env.BASE_URL ?? "/";
  if (!base.endsWith("/")) base += "/";
  if (href.startsWith(base)) return href;
  return base + href.slice(1);
}
