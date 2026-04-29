/**
 * remark plugin: convert ```mermaid fenced code blocks into a raw HTML
 * node Mermaid can find at runtime.
 *
 * Output:  <pre class="mermaid">CODE</pre>
 *
 * Layout.astro dynamically imports mermaid only when it sees a
 * `pre.mermaid` element on the page, so pages without diagrams pay
 * nothing. Indentation and special characters in the source are preserved
 * verbatim.
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

function escape(s) {
  return s.replace(/[&<>]/g, (c) => ESC[c]);
}

export default function remarkMermaid() {
  return (tree) => {
    walk(tree, (node, parent, index) => {
      if (
        node.type === "code" &&
        typeof node.lang === "string" &&
        node.lang.toLowerCase() === "mermaid" &&
        parent &&
        typeof index === "number"
      ) {
        const html = `<pre class="mermaid">${escape(node.value ?? "")}</pre>`;
        parent.children[index] = { type: "html", value: html };
      }
    });
  };
}

function walk(tree, fn, parent = null, index = 0) {
  if (!tree) return;
  fn(tree, parent, index);
  if (Array.isArray(tree.children)) {
    for (let i = 0; i < tree.children.length; i++) {
      walk(tree.children[i], fn, tree, i);
    }
  }
}
