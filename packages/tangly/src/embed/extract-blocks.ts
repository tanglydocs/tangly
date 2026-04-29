import GitHubSlugger from "github-slugger";

/**
 * Extract block IDs from MDX body content. Two sources:
 *
 *   1. Heading IDs auto-generated from heading text (matching rehype-slug,
 *      which uses github-slugger).
 *   2. Explicit `{#custom-id}` markers — tolerated after a heading or at
 *      the end of any line/paragraph.
 *
 * The returned map is `id -> block` where `block` is the section of MDX
 * starting at the matched heading (or the line carrying the explicit ID)
 * and ending right before the next sibling heading at the same or higher
 * level.
 */
export interface BlockMap {
  /** Block ID (slug) -> MDX source for that block. */
  blocks: Record<string, string>;
  /** All IDs in document order, for error messages. */
  order: string[];
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const EXPLICIT_ID_RE = /\{#([a-zA-Z0-9][\w-]*)\}/g;

interface Section {
  id: string;
  level: number;
  startLine: number;
  endLine: number; // exclusive
}

export function extractBlocks(mdx: string): BlockMap {
  const lines = mdx.split("\n");
  const slugger = new GitHubSlugger();
  const headingSections: Section[] = [];

  // Pass 1: locate every heading + auto-slug.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.startsWith("```") || line.startsWith("~~~")) {
      // Skip fenced code blocks entirely.
      const fence = line.slice(0, 3);
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith(fence)) i += 1;
      continue;
    }
    const m = HEADING_RE.exec(line);
    if (!m) continue;
    const level = m[1]!.length;
    const text = m[2]!;
    // Reconcile with any explicit-id marker on the heading line.
    const explicit = [...text.matchAll(EXPLICIT_ID_RE)].map((mm) => mm[1]!);
    const cleanText = text.replace(EXPLICIT_ID_RE, "").trim();
    const id = explicit[0] ?? slugger.slug(cleanText);
    headingSections.push({ id, level, startLine: i, endLine: lines.length });
  }

  // Pass 2: close each section at the next sibling/parent heading.
  for (let i = 0; i < headingSections.length; i += 1) {
    const cur = headingSections[i]!;
    for (let j = i + 1; j < headingSections.length; j += 1) {
      const next = headingSections[j]!;
      if (next.level <= cur.level) {
        cur.endLine = next.startLine;
        break;
      }
    }
  }

  const blocks: Record<string, string> = {};
  const order: string[] = [];
  for (const s of headingSections) {
    const body = lines.slice(s.startLine, s.endLine).join("\n");
    blocks[s.id] = body;
    order.push(s.id);
  }

  // Pass 3: explicit `{#custom-id}` markers attached to non-heading lines.
  // These name a paragraph/list/block — capture from the marker line until
  // the next blank line or next heading.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.startsWith("```") || line.startsWith("~~~")) {
      // Skip fenced code blocks so `{#foo}` inside a sample isn't captured.
      const fence = line.slice(0, 3);
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith(fence)) i += 1;
      continue;
    }
    if (HEADING_RE.test(line)) continue;
    const matches = [...line.matchAll(EXPLICIT_ID_RE)];
    if (matches.length === 0) continue;
    for (const m of matches) {
      const id = m[1]!;
      if (blocks[id] !== undefined) continue; // heading already claimed it
      let end = i + 1;
      while (end < lines.length) {
        const ln = lines[end] ?? "";
        if (ln.trim() === "") break;
        if (HEADING_RE.test(ln)) break;
        end += 1;
      }
      const body = lines.slice(i, end).join("\n").replace(EXPLICIT_ID_RE, "").trim();
      blocks[id] = body;
      order.push(id);
    }
  }

  return { blocks, order };
}
