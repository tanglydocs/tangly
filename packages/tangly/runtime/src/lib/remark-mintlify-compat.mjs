// remark plugin: pre-process Mintlify quirks before MDX's JSX parser
// sees the source.
//
//   <latex>...</latex>  ->  block math fence ($$...$$)
//   <Latex>...</Latex>  ->  same
//
// Without this, LaTeX expressions like \sum_{j=1}^M get parsed by MDX as
// {j=1} JSX expressions and either crash on unknown identifiers or get
// rendered as plain JS.
//
// Skips code spans and fenced code blocks so docs that quote the literal
// pattern inside backticks don't get silently rewritten. Mirrors the
// helper in packages/tangly/src/plugin/replace-outside-code.ts; duplicated
// here because this is .mjs runtime code.

function findCodeRegions(src) {
  const regions = [];
  const fenceRe = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n\1\2[ \t]*(?:\n|$)|$)/gm;
  let f;
  while ((f = fenceRe.exec(src)) !== null) {
    regions.push([f.index, f.index + f[0].length]);
  }
  const inFence = (idx) => regions.some(([s, e]) => idx >= s && idx < e);
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
        regions.push([i, j + m]);
        i = j + m;
        break;
      }
      j += m;
    }
    if (j >= src.length) i += n;
  }
  return regions;
}

function replaceOutsideCode(src, re, replacer) {
  const regions = findCodeRegions(src);
  const overlaps = (idx, len) => regions.some(([s, e]) => !(idx + len <= s || idx >= e));
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
  if (!changed) return src;
  return out + src.slice(last);
}

export default function remarkMintlifyCompat() {
  return (_tree, file) => {
    if (typeof file.value !== "string") return;
    file.value = replaceOutsideCode(
      file.value,
      /<latex>([\s\S]*?)<\/latex>/gi,
      (_match, body) => `\n\n$$\n${body.trim()}\n$$\n\n`,
    );
  };
}
