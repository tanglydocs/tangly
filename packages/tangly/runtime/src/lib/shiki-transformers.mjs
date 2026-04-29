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

/**
 * Numbered inline annotations. When fence meta contains `annotate`, the
 * trailing `(N)` (optionally inside `// (N)`, `# (N)`, `<!-- (N) -->`,
 * `/* (N) *\/`) on each line is stripped and replaced with a numbered
 * pill button. The post-shiki rehype plugin then pairs the next adjacent
 * `<ol>` as the annotation panel.
 *
 * Defensive: never throws — unexpected AST shapes leave the line alone.
 */
const ANNOTATION_TAIL_RE =
  /(\s*(?:\/\/|#|<!--|\/\*)\s*)?\((\d+)\)(\s*(?:-->|\*\/))?\s*$/;

export function transformerTanglyAnnotations() {
  return {
    name: "tangly:annotations",
    line(line) {
      try {
        const meta = this.options?.meta?.__raw ?? "";
        if (!metaHas(meta, "annotate")) return;
        const text = collectText(line);
        if (!text) return;
        const m = text.match(ANNOTATION_TAIL_RE);
        if (!m) return;
        const matchLen = m[0].length;
        const n = m[2];
        if (!stripTrailing(line, matchLen)) return;
        line.children.push({
          type: "element",
          tagName: "button",
          properties: {
            type: "button",
            className: ["tangly-annotation-marker"],
            "data-tangly-annotation": n,
            ariaLabel: `Annotation ${n}`,
            tabIndex: 0,
          },
          children: [{ type: "text", value: n }],
        });
        const pre = this.pre ?? null;
        if (pre && pre.properties) {
          pre.properties["data-tangly-annotated"] = "true";
        }
      } catch {
        /* never break MDX render */
      }
    },
  };
}

function collectText(node) {
  if (!node) return "";
  if (node.type === "text") return typeof node.value === "string" ? node.value : "";
  if (!Array.isArray(node.children)) return "";
  let out = "";
  for (const c of node.children) out += collectText(c);
  return out;
}

/**
 * Remove the last `n` characters of the rendered text from the line's
 * trailing descendants, working right-to-left through token spans. Empty
 * spans are pruned. Returns false if the requested length doesn't fit.
 */
function stripTrailing(line, n) {
  if (n <= 0) return true;
  let remaining = n;
  function recur(node) {
    if (!node || remaining <= 0) return;
    if (node.type === "text") {
      const v = typeof node.value === "string" ? node.value : "";
      if (v.length >= remaining) {
        node.value = v.slice(0, v.length - remaining);
        remaining = 0;
      } else {
        node.value = "";
        remaining -= v.length;
      }
      return;
    }
    if (!Array.isArray(node.children)) return;
    for (let i = node.children.length - 1; i >= 0 && remaining > 0; i--) {
      const c = node.children[i];
      recur(c);
      if (
        c &&
        ((c.type === "text" && c.value === "") ||
          (c.type === "element" &&
            Array.isArray(c.children) &&
            c.children.length === 0))
      ) {
        node.children.splice(i, 1);
      }
    }
  }
  recur(line);
  return remaining === 0;
}

export { iconForFilename, parseMetaTitle, metaHas };
