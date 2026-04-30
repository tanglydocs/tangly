/**
 * rehype plugin: prepend Astro's BASE_URL to root-relative internal links.
 *
 * MDX content like `[Quickstart](/quickstart)` compiles to
 * `<a href="/quickstart">` which doesn't survive a non-root base
 * (e.g. GitHub Pages serving from `/tangly/`). Astro's compiler
 * doesn't rewrite these for raw markdown.
 *
 * Skips:
 *   - external URLs (http://, https://, mailto:, tel:, //)
 *   - anchor-only links (#section)
 *   - already-prefixed links (starting with the configured base)
 *   - non-link relative paths (./foo, ../foo)
 */
export default function rehypeBaseLinks(opts = {}) {
  let base = opts.base ?? "/";
  if (!base.endsWith("/")) base += "/";
  if (base === "/") {
    // No-op when base is root.
    return () => {};
  }

  return (tree) => {
    walk(tree, base);
  };
}

function walk(node, base) {
  if (!node || typeof node !== "object") return;
  if (node.tagName === "a" && node.properties && typeof node.properties.href === "string") {
    node.properties.href = rewrite(node.properties.href, base);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, base);
  }
}

function rewrite(href, base) {
  if (!href.startsWith("/")) return href; // relative or anchor
  if (href.startsWith("//")) return href; // protocol-relative
  if (href.startsWith(base)) return href; // already prefixed
  // base ends with /, href starts with / → strip one
  return base + href.slice(1);
}
