/**
 * Make imported MDX snippets inherit the page's MDX component set.
 *
 * Astro compiles `<NoteSnip />` (where NoteSnip is `import NoteSnip from
 * "/snippets/foo.mdx"`) to `_jsx(NoteSnip, {})` — with no `components` prop. So
 * inside the snippet, `props.components` is empty and any MDX component it uses
 * (`<Note>`, `<Card>`, …) resolves to undefined and throws
 * "Expected component `Note` to be defined".
 *
 * Mintlify renders snippets in the host's component scope. To match that, this
 * recma plugin threads the host's `props.components` into every `_jsx`/`_jsxs`
 * call whose component is an `.mdx` import, unless the call site already passes
 * an explicit `components` prop. `props` is the `_createMdxContent(props)`
 * parameter and is always in scope at these call sites.
 *
 * `.jsx`/`.tsx` snippets are framework islands, not MDX, so their imports are
 * left alone (handled by remark-snippet-islands).
 */
const SKIP_KEYS = new Set(["loc", "start", "end", "range", "position", "comments"]);
const JSX_CALLEE = /^_jsxs?(DEV)?$/;

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor);
    return;
  }
  if (typeof node.type === "string") visitor(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (value && typeof value === "object") walk(value, visitor);
  }
}

function componentsProperty() {
  return {
    type: "Property",
    method: false,
    shorthand: false,
    computed: false,
    kind: "init",
    key: { type: "Identifier", name: "components" },
    value: {
      type: "MemberExpression",
      optional: false,
      computed: false,
      object: { type: "Identifier", name: "props" },
      property: { type: "Identifier", name: "components" },
    },
  };
}

function hasComponentsKey(objectExpression) {
  return objectExpression.properties.some(
    (p) =>
      p.type === "Property" &&
      p.key &&
      ((p.key.type === "Identifier" && p.key.name === "components") ||
        (p.key.type === "Literal" && p.key.value === "components")),
  );
}

export default function recmaSnippetComponents() {
  return (tree) => {
    /** @type {Set<string>} local identifiers bound to an .mdx import */
    const mdxNames = new Set();
    walk(tree, (node) => {
      if (
        node.type === "ImportDeclaration" &&
        typeof node.source?.value === "string" &&
        node.source.value.endsWith(".mdx")
      ) {
        for (const spec of node.specifiers ?? []) {
          if (spec.local?.name) mdxNames.add(spec.local.name);
        }
      }
    });
    if (mdxNames.size === 0) return;

    walk(tree, (node) => {
      if (node.type !== "CallExpression") return;
      if (node.callee?.type !== "Identifier" || !JSX_CALLEE.test(node.callee.name)) return;
      const first = node.arguments?.[0];
      if (first?.type !== "Identifier" || !mdxNames.has(first.name)) return;

      let propsArg = node.arguments[1];
      if (!propsArg || propsArg.type !== "ObjectExpression") {
        propsArg = { type: "ObjectExpression", properties: [] };
        node.arguments[1] = propsArg;
      }
      if (hasComponentsKey(propsArg)) return;
      propsArg.properties.unshift(componentsProperty());
    });
  };
}
