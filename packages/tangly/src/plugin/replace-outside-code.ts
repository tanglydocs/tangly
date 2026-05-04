// Run a regex/replacer over raw MDX text but skip matches inside code
// spans and fenced code blocks.
//
// Used by Tangly's pre-MDX shims (<latex>...</latex> -> block math,
// markdown image refs with ../ paths -> root-absolute) so docs that need
// to describe those shims can quote their literal trigger patterns inside
// backticks without being silently rewritten on the way through.
//
// Doesn't honor 4-space-indented code blocks; fenced + inline covers the
// docs corpus.

type CodeRegion = readonly [start: number, end: number];

function findCodeRegions(src: string): CodeRegion[] {
  const regions: CodeRegion[] = [];

  // Fenced blocks first so the inline-span scan can skip ranges inside them.
  const fenceRe = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n\1\2[ \t]*(?:\n|$)|$)/gm;
  let f: RegExpExecArray | null;
  while ((f = fenceRe.exec(src)) !== null) {
    regions.push([f.index, f.index + f[0].length] as const);
  }

  // Inline code spans: a run of N backticks opens a span that closes at the
  // next run of exactly N backticks.
  const inFence = (idx: number) => regions.some(([s, e]) => idx >= s && idx < e);
  let i = 0;
  while (i < src.length) {
    if (inFence(i)) {
      i++;
      continue;
    }
    if (src.charCodeAt(i) !== 96) {
      i++;
      continue;
    }
    let n = 1;
    while (src.charCodeAt(i + n) === 96) n++;
    let j = i + n;
    while (j < src.length) {
      if (src.charCodeAt(j) !== 96) {
        j++;
        continue;
      }
      let m = 1;
      while (src.charCodeAt(j + m) === 96) m++;
      if (m === n) {
        regions.push([i, j + m] as const);
        i = j + m;
        break;
      }
      j += m;
    }
    if (j >= src.length) {
      i += n;
    }
  }

  return regions;
}

export function replaceOutsideCode(
  src: string,
  re: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): { value: string; changed: boolean } {
  if (!re.global) {
    throw new Error("replaceOutsideCode requires a global regex");
  }
  const regions = findCodeRegions(src);
  const overlaps = (idx: number, len: number) =>
    regions.some(([s, e]) => !(idx + len <= s || idx >= e));

  let out = "";
  let last = 0;
  let changed = false;
  for (const m of src.matchAll(re)) {
    const idx = m.index ?? -1;
    if (idx < 0) continue;
    if (overlaps(idx, m[0].length)) continue;
    out += src.slice(last, idx) + replacer(m[0], ...m.slice(1));
    last = idx + m[0].length;
    changed = true;
  }
  if (!changed) return { value: src, changed: false };
  out += src.slice(last);
  return { value: out, changed: true };
}
