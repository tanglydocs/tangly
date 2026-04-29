/**
 * rehype plugin: pair `<figure data-tangly-code>` with annotation markers
 * to the next adjacent `<ol>`.
 *
 * Runs after `@shikijs/rehype`. The annotation transformer marked each
 * relevant `<pre>` with `data-tangly-annotated="true"`. The chrome
 * transformer then wrapped that pre in a `<figure>`. In Astro's MDX
 * pipeline the resulting figure is itself wrapped in an inline `root`
 * node, so the `<ol>` that follows it in the source lives at the parent
 * level — not as a direct sibling. We flatten nested `root` children
 * when walking siblings so the pairing works regardless of the wrap.
 *
 * The matched `<ol>` gains class `tangly-code-annotation-list` and each
 * `<li>` gets `data-tangly-annotation-target="N"` (1-based).
 */

export default function rehypeAnnotations() {
  return (tree) => {
    walk(tree);
  };
}

function walk(node) {
  if (!node || (node.type !== "root" && node.type !== "element")) return;
  const children = node.children;
  if (!Array.isArray(children)) return;

  const flat = flattenSiblings(children);
  for (let i = 0; i < flat.length; i++) {
    const entry = flat[i];
    const child = entry.node;
    if (!child || child.type !== "element") continue;
    if (hasAnnotatedPre(child)) {
      const next = nextNonWhitespace(flat, i);
      if (next && next.type === "element" && next.tagName === "ol") {
        markAnnotationList(next);
      }
    }
  }

  // Recurse into element children (not into root children — those were
  // already inlined by flattenSiblings, but their nested elements still
  // need traversal in case they contain their own annotated pairs).
  for (const child of children) {
    if (child?.type === "element" || child?.type === "root") walk(child);
  }
}

/**
 * Produce a flat sibling list where any nested `root` nodes contribute
 * their own children inline. Each entry retains the original node so the
 * `markAnnotationList` mutation lands on the actual AST node.
 */
function flattenSiblings(children) {
  const out = [];
  for (const c of children) {
    if (!c) continue;
    if (c.type === "root" && Array.isArray(c.children)) {
      for (const grand of c.children) {
        if (!grand) continue;
        out.push({ node: grand, type: grand.type, tagName: grand.tagName });
      }
    } else {
      out.push({ node: c, type: c.type, tagName: c.tagName });
    }
  }
  return out;
}

function hasAnnotatedPre(el) {
  if (!el || el.type !== "element" || !Array.isArray(el.children)) return false;
  for (const c of el.children) {
    if (!c || c.type !== "element") continue;
    if (c.tagName !== "pre") continue;
    const v = c.properties?.["data-tangly-annotated"] ?? c.properties?.dataTanglyAnnotated;
    if (v === "true" || v === true) return true;
  }
  return false;
}

function nextNonWhitespace(flat, fromIndex) {
  for (let j = fromIndex + 1; j < flat.length; j++) {
    const e = flat[j];
    if (!e) continue;
    if (e.type === "text" && typeof e.node?.value === "string" && e.node.value.trim() === "") {
      continue;
    }
    return e.node;
  }
  return null;
}

function markAnnotationList(ol) {
  const props = ol.properties ?? (ol.properties = {});
  const existing = props.className;
  const classes = Array.isArray(existing)
    ? existing
    : typeof existing === "string"
      ? existing.split(/\s+/).filter(Boolean)
      : [];
  if (!classes.includes("tangly-code-annotation-list")) {
    classes.push("tangly-code-annotation-list");
  }
  props.className = classes;

  let idx = 1;
  for (const li of ol.children ?? []) {
    if (!li || li.type !== "element" || li.tagName !== "li") continue;
    const liProps = li.properties ?? (li.properties = {});
    liProps["data-tangly-annotation-target"] = String(idx);
    idx++;
  }
}
