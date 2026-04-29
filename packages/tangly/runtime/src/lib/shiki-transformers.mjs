// Shiki transformer that wraps each highlighted <pre> in a <figure> with
// header chrome (filename, language label, copy button). Reads fence meta
// for `title="..."` and `noCopy`. Designed to be the LAST shiki transformer
// in the chain — runs after notation/diff/highlight have rewritten the
// pre's children.

const FILE_ICONS = {
  ts: "file-code",
  tsx: "file-code",
  js: "file-code",
  jsx: "file-code",
  mjs: "file-code",
  cjs: "file-code",
  json: "braces",
  yaml: "file-text",
  yml: "file-text",
  toml: "file-text",
  md: "file-text",
  mdx: "file-text",
  html: "file-code",
  css: "palette",
  scss: "palette",
  sh: "terminal",
  bash: "terminal",
  zsh: "terminal",
  fish: "terminal",
  py: "file-code",
  rb: "file-code",
  go: "file-code",
  rs: "file-code",
  java: "file-code",
  php: "file-code",
  sql: "database",
  env: "key",
  txt: "file-text",
};

function iconForFilename(filename) {
  if (!filename) return "file";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "file";
}

function parseMetaTitle(meta) {
  if (!meta) return null;
  const quoted = meta.match(/title="([^"]+)"/);
  if (quoted) return quoted[1];
  const single = meta.match(/title='([^']+)'/);
  if (single) return single[1];
  // Mintlify-style bare path token.
  const tokens = meta.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (/^[A-Za-z0-9._/-]+\.[A-Za-z0-9]+$/.test(t)) return t;
  }
  return null;
}

function metaHas(meta, flag) {
  if (!meta) return false;
  const re = new RegExp(`(^|\\s)${flag}(\\s|=|$)`);
  return re.test(meta);
}

/**
 * Wrap each pre.shiki in a figure with title + lang label + copy button.
 * Runs as a single shiki transformer to avoid plugin-order issues.
 *
 * Defensive: never throws — if the AST shape is unexpected, leaves the
 * fragment alone.
 */
export function transformerTanglyChrome(opts = {}) {
  const copyButtonDefault = opts.copyButton !== false;
  return {
    name: "tangly:chrome",
    root(root) {
      try {
        const meta = this.options?.meta?.__raw ?? "";
        const lang = this.options?.lang ?? "";
        const title = parseMetaTitle(meta);
        const noCopy = metaHas(meta, "noCopy");
        const showCopy = copyButtonDefault && !noCopy;

        const children = root?.children ?? [];
        for (let i = 0; i < children.length; i++) {
          const node = children[i];
          if (!node || node.type !== "element" || node.tagName !== "pre") continue;

          // Add data attrs so CodeGroup can pick up filename/lang.
          const props = node.properties ?? (node.properties = {});
          if (title) props["data-filename"] = title;
          if (lang) props["data-language"] = lang;

          const headerChildren = [];
          if (title) {
            headerChildren.push({
              type: "element",
              tagName: "div",
              properties: { className: ["tangly-code-title"] },
              children: [
                {
                  type: "element",
                  tagName: "span",
                  properties: {
                    className: ["tangly-code-icon"],
                    "data-icon": iconForFilename(title),
                  },
                  children: [],
                },
                { type: "text", value: title },
              ],
            });
          }
          if (lang) {
            headerChildren.push({
              type: "element",
              tagName: "span",
              properties: { className: ["tangly-code-lang"] },
              children: [{ type: "text", value: lang }],
            });
          }
          if (showCopy) {
            headerChildren.push({
              type: "element",
              tagName: "button",
              properties: {
                type: "button",
                className: ["tangly-code-copy"],
                "data-tangly-copy": "true",
                ariaLabel: "Copy code",
                title: "Copy",
              },
              children: [
                {
                  type: "element",
                  tagName: "span",
                  properties: { className: ["tangly-code-copy-idle"] },
                  children: [{ type: "text", value: "Copy" }],
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: {
                    className: ["tangly-code-copy-done"],
                    hidden: true,
                  },
                  children: [{ type: "text", value: "Copied" }],
                },
              ],
            });
          }

          if (headerChildren.length === 0) continue;

          children[i] = {
            type: "element",
            tagName: "figure",
            properties: {
              className: ["tangly-code-figure"],
              "data-tangly-code": "true",
            },
            children: [
              {
                type: "element",
                tagName: "figcaption",
                properties: { className: ["tangly-code-header"] },
                children: headerChildren,
              },
              node,
            ],
          };
        }
      } catch {
        /* never break MDX render */
      }
    },
  };
}

export { iconForFilename, parseMetaTitle, metaHas };
