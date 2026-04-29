/**
 * remark plugin: honour `{#custom-id}` markers on headings.
 *
 * Mirrors the extractor in `tangly/src/embed/extract-blocks.ts` so that
 * `<Embed page="x" block="my-id" />` links to a real anchor on the source
 * page (`/x#my-id`).
 *
 * For headings:
 *   `## Service tiers {#tiers}` -> the heading text becomes "Service tiers"
 *   and the rendered `<h2>` gets `id="tiers"` (overriding rehype-slug).
 */
const ID_MARKER = /\{#([a-zA-Z0-9][\w-]*)\}/g;

export default function remarkExplicitIds() {
  return (tree) => {
    walk(tree, "heading", (node) => {
      const lastChild = node.children[node.children.length - 1];
      if (!lastChild || lastChild.type !== "text") return;
      const text = lastChild.value;
      const match = ID_MARKER.exec(text);
      ID_MARKER.lastIndex = 0;
      if (!match) return;
      const id = match[1];
      lastChild.value = text.replace(ID_MARKER, "").trimEnd();
      node.data ??= {};
      node.data.id = id;
      node.data.hProperties ??= {};
      node.data.hProperties.id = id;
    });
  };
}

function walk(tree, type, fn) {
  if (!tree) return;
  if (tree.type === type) fn(tree);
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) walk(child, type, fn);
  }
}
