import { readFileSync } from "node:fs";

/**
 * rehype plugin: auto-link glossary terms.
 *
 * Walks every text node in the page's HAST and wraps the FIRST occurrence
 * (per page) of each glossary term/alias in:
 *
 *   <a class="tangly-glossary-term"
 *      href="/glossary#<slug>"
 *      data-definition="<def>"
 *      data-term="<term>">...</a>
 *
 * Skips text inside <code>, <pre>, <a>, and h1-h6.
 *
 * Skips the entire glossary page itself - when the source file path looks
 * like the glossary file, auto-linking would re-link every term back to
 * its own definition.
 */

const SKIP_TAGS = new Set([
  "code",
  "pre",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "script",
  "style",
]);

/**
 * @typedef {object} GlossaryEntry
 * @property {string} term
 * @property {string[]} aliases
 * @property {string} slug
 * @property {string} definition
 */

/**
 * @param {{ entries?: GlossaryEntry[] }} [opts]
 */
export default function rehypeGlossary(opts = {}) {
  const entries = Array.isArray(opts.entries) ? opts.entries : [];
  const compiled = compile(entries);

  return (tree, file) => {
    if (!compiled || compiled.lookups.size === 0) return;
    if (isGlossarySource(file)) return;
    if (hasGlossaryOptOut(file)) return;

    const seen = new Set();
    walkAndWrap(tree, compiled, seen);
  };
}

function isGlossarySource(file) {
  const path =
    (file && (file.path || (file.history && file.history[file.history.length - 1]))) || "";
  if (typeof path !== "string" || !path) return false;
  const norm = path.replace(/\\/g, "/");
  if (/\/glossary\.mdx?$/i.test(norm)) return true;
  if (/\/glossary\/[^/]+\.mdx?$/i.test(norm)) return true;
  return false;
}

/**
 * Honour `glossary: false` in page frontmatter. Astro's MDX integration
 * doesn't reliably populate `file.data.astro.frontmatter` by the time
 * rehype runs, so we re-read the source file (cheap — already on disk,
 * and gray-matter only parses the YAML head) when a path is available.
 */
function hasGlossaryOptOut(file) {
  const path =
    (file && (file.path || (file.history && file.history[file.history.length - 1]))) || "";
  if (typeof path !== "string" || !path) return false;
  const fmFromAstro = file?.data?.astro?.frontmatter;
  if (fmFromAstro && fmFromAstro.glossary === false) return true;
  try {
    const raw = readFileSync(path, "utf8");
    // Cheap front-matter sniff — avoid pulling gray-matter into the runtime.
    const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(raw);
    if (!m) return false;
    return /^\s*glossary\s*:\s*false\s*$/m.test(m[1] ?? "");
  } catch {
    return false;
  }
}

function compile(entries) {
  if (!entries.length) return null;
  /** @type {Map<string, GlossaryEntry>} */
  const lookups = new Map();
  /** @type {string[]} */
  const variants = [];

  for (const entry of entries) {
    if (!entry || typeof entry.term !== "string") continue;
    addVariant(entry.term, entry, lookups, variants);
    if (Array.isArray(entry.aliases)) {
      for (const a of entry.aliases) {
        if (typeof a === "string") addVariant(a, entry, lookups, variants);
      }
    }
  }
  if (!variants.length) return null;

  // Sort longest-first so multi-word terms beat their substrings.
  variants.sort((a, b) => b.length - a.length);
  const pattern = variants.map(escapeRegex).join("|");
  const re = new RegExp("(?<![A-Za-z0-9_])(?:" + pattern + ")(?![A-Za-z0-9_])", "gi");
  return { re, lookups };
}

function addVariant(text, entry, lookups, variants) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (lookups.has(key)) return;
  lookups.set(key, entry);
  variants.push(trimmed);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Walk the HAST tree, mutating in place. Mutates parent.children when a
 * text node yields one or more matches.
 */
function walkAndWrap(node, compiled, seen) {
  if (!node) return;
  if (node.type === "element" && SKIP_TAGS.has(node.tagName)) return;
  if (!Array.isArray(node.children)) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!child) continue;
    if (child.type === "text" && typeof child.value === "string") {
      const replacement = scanAndWrap(child.value, compiled, seen);
      if (replacement) {
        node.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }
    if (child.type === "element" || child.type === "root") {
      walkAndWrap(child, compiled, seen);
    }
  }
}

/**
 * Scan one text-node value; return replacement HAST children or null.
 * First-occurrence-per-term-per-page is enforced via the shared `seen` set.
 */
function scanAndWrap(value, compiled, seen) {
  const { re, lookups } = compiled;
  re.lastIndex = 0;
  const hits = [];
  const usedThisPass = new Set();
  let m;
  while ((m = re.exec(value)) !== null) {
    const matchText = m[0];
    const entry = lookups.get(matchText.toLowerCase());
    if (!entry) continue;
    if (seen.has(entry.slug) || usedThisPass.has(entry.slug)) continue;
    usedThisPass.add(entry.slug);
    hits.push({
      start: m.index,
      end: m.index + matchText.length,
      entry,
      raw: matchText,
    });
  }
  if (!hits.length) return null;
  for (const h of hits) seen.add(h.entry.slug);
  hits.sort((a, b) => a.start - b.start);

  const out = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) {
      out.push({ type: "text", value: value.slice(cursor, hit.start) });
    }
    out.push({
      type: "element",
      tagName: "a",
      properties: {
        className: ["tangly-glossary-term"],
        href: hit.entry.href || "/glossary#" + hit.entry.slug,
        "data-definition": hit.entry.definition,
        "data-term": hit.entry.term,
      },
      children: [{ type: "text", value: hit.raw }],
    });
    cursor = hit.end;
  }
  if (cursor < value.length) {
    out.push({ type: "text", value: value.slice(cursor) });
  }
  return out;
}
