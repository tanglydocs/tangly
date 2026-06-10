import { replaceOutsideCode } from "./replace-outside-code.js";

/**
 * Source-level Mintlify-compat rewrites applied to `.mdx`/`.md` BEFORE the
 * MDX compiler parses the file. Shared by the Vite plugin (dev + build) and
 * `tangly check` so check-time parsing sees exactly what the build sees.
 */
export function applyMdxSourceCompat(code: string): { code: string; changed: boolean } {
  let out = code;
  let changed = false;

  // <latex>...</latex> contains raw LaTeX whose curly braces would
  // otherwise be parsed as JSX expressions, breaking the build.
  // Skip code spans/fences so docs describing this shim can quote the
  // literal pattern inside backticks without it getting rewritten.
  if (/<latex>/i.test(out)) {
    const r = replaceOutsideCode(
      out,
      /<latex>([\s\S]*?)<\/latex>/gi,
      (_m, body) => `\n\n$$\n${body.trim()}\n$$\n\n`,
    );
    if (r.changed) {
      out = r.value;
      changed = true;
    }
  }

  // Rewrite Markdown image references that point outside the file's
  // directory or use relative parent traversal. Many docs corpora
  // ship `![alt](../images/foo.webp)` expecting the project root to
  // act as the public base. Astro's asset pipeline tries to resolve
  // these as build-time assets and fails when the cache has stale
  // entries; rewriting them to root-absolute paths routes them through
  // our static-asset middleware (dev) and copy-assets step (build).
  //
  // Match: ![alt](../something/foo.webp)  → ![alt](/something/foo.webp)
  // Don't touch: absolute URLs (http*) or already-rooted paths (/foo),
  // or anything inside backticks (so docs can quote the pattern).
  {
    const r = replaceOutsideCode(
      out,
      /!\[([^\]]*)\]\(\s*((?:\.\.\/)+)([^)\s]+)\)/g,
      (_m, alt, _dots, rest) => {
        const abs = rest.startsWith("/") ? rest : `/${rest}`;
        return `![${alt}](${abs})`;
      },
    );
    if (r.changed) {
      out = r.value;
      changed = true;
    }
  }

  return { code: out, changed };
}
