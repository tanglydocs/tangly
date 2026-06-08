import { visit } from "unist-util-visit";

/**
 * Mintlify lets a page import a React component snippet and use it bare:
 *
 *   import { IframeDemo } from "/snippets/IframeDemo.jsx";
 *   <IframeDemo />
 *
 * Under Astro a framework component with no `client:*` directive renders to
 * static HTML and never hydrates, so the interactive bits (state, inputs) are
 * dead. Mintlify components are interactive, so to match them we auto-attach
 * `client:visible` to every JSX element whose name was imported from a
 * `/snippets/*.{jsx,tsx}` module. An author-supplied `client:*` directive wins.
 *
 * `.mdx` snippet imports are deliberately ignored — those are content, not
 * islands, and are handled by component injection instead.
 */
const SNIPPET_RE = /\/snippets\/[^"']+\.(?:jsx|tsx)$/;

export default function remarkSnippetIslands() {
  return (tree) => {
    /** @type {Set<string>} local identifiers bound to a jsx/tsx snippet */
    const islandNames = new Set();

    visit(tree, "mdxjsEsm", (node) => {
      const estree = node.data?.estree;
      if (estree && Array.isArray(estree.body)) {
        for (const stmt of estree.body) {
          if (stmt.type !== "ImportDeclaration") continue;
          const src = stmt.source?.value;
          if (typeof src !== "string" || !SNIPPET_RE.test(src)) continue;
          for (const spec of stmt.specifiers ?? []) {
            const name = spec.local?.name;
            if (name) islandNames.add(name);
          }
        }
      } else if (typeof node.value === "string") {
        collectFromSource(node.value, islandNames);
      }
    });

    if (islandNames.size === 0) return;

    const tag = (node) => {
      if (typeof node.name !== "string" || !islandNames.has(node.name)) return;
      const attrs = node.attributes ?? (node.attributes = []);
      const hasClient = attrs.some(
        (a) =>
          a.type === "mdxJsxAttribute" &&
          typeof a.name === "string" &&
          a.name.startsWith("client:"),
      );
      if (hasClient) return;
      attrs.push({ type: "mdxJsxAttribute", name: "client:visible", value: null });
    };

    visit(tree, "mdxJsxFlowElement", tag);
    visit(tree, "mdxJsxTextElement", tag);
  };
}

/** Regex fallback when an ESM node has no parsed estree attached. */
function collectFromSource(code, set) {
  const re = /import\s+([^;]+?)\s+from\s+["'](\/snippets\/[^"']+\.(?:jsx|tsx))["']/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const clause = m[1].trim();
    const braced = clause.match(/\{([^}]*)\}/);
    const beforeBrace = clause.split("{")[0].replace(/,\s*$/, "").trim();
    if (beforeBrace && !beforeBrace.startsWith("*")) set.add(beforeBrace);
    if (braced) {
      for (const part of braced[1].split(",")) {
        const name = part
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name) set.add(name);
      }
    }
  }
}
