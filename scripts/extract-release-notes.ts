#!/usr/bin/env bun
// Extract the body of the <Update label="vX.Y.Z"> block matching the given
// version from docs/changelog.mdx, and print it to stdout.
//
// Used by the release workflow to feed `gh release create --notes-file`.
// Exit 0 on hit, exit 1 on miss (CI falls back to --generate-notes).
//
// Usage:
//   bun run scripts/extract-release-notes.ts 0.0.13

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const changelogPath = resolve(repoRoot, "docs/changelog.mdx");

const version = process.argv[2];
if (!version) {
  console.error("usage: extract-release-notes.ts <version>");
  process.exit(2);
}

if (!existsSync(changelogPath)) {
  console.error(`changelog not found: ${changelogPath}`);
  process.exit(1);
}

const src = readFileSync(changelogPath, "utf8");

// Find the opening <Update ...> tag whose label matches the version.
// Accepts both `vX.Y.Z` and bare `X.Y.Z`.
const labelRx = new RegExp(`<Update\\s+[^>]*label="v?${version.replace(/[.+]/g, "\\$&")}"[^>]*>`);
const openMatch = src.match(labelRx);
if (!openMatch || openMatch.index === undefined) {
  console.error(`no <Update label="v${version}"> in ${changelogPath}`);
  process.exit(1);
}

const bodyStart = openMatch.index + openMatch[0].length;

// Depth-aware scan to the matching </Update>. <Update> blocks shouldn't nest,
// but be defensive. Use indexOf rather than RegExp.exec so we don't trip
// editor heuristics on the substring "exec(".
const OPEN = "<Update";
const CLOSE = "</Update>";

function findOpenAfter(start: number): number {
  // Match <Update followed by whitespace OR > (e.g., <Updated... is not a match).
  let pos = start;
  while (pos < src.length) {
    const idx = src.indexOf(OPEN, pos);
    if (idx === -1) return -1;
    const ch = src.charAt(idx + OPEN.length);
    if (ch === " " || ch === "\t" || ch === "\n" || ch === ">") return idx;
    pos = idx + OPEN.length;
  }
  return -1;
}

let depth = 1;
let cursor = bodyStart;
let bodyEnd = -1;
while (cursor < src.length) {
  const nextClose = src.indexOf(CLOSE, cursor);
  if (nextClose === -1) break;
  const nextOpen = findOpenAfter(cursor);
  if (nextOpen !== -1 && nextOpen < nextClose) {
    depth++;
    cursor = nextOpen + OPEN.length;
  } else {
    depth--;
    if (depth === 0) {
      bodyEnd = nextClose;
      break;
    }
    cursor = nextClose + CLOSE.length;
  }
}

if (bodyEnd === -1) {
  console.error(`unterminated <Update> block for v${version}`);
  process.exit(1);
}

let body = src.slice(bodyStart, bodyEnd);

body = body.replace(/^\n+/, "").replace(/\n+$/, "");

// Dedent: find the minimum leading-space indent across non-blank lines.
const lines = body.split("\n");
let minIndent = Infinity;
for (const line of lines) {
  if (!line.trim()) continue;
  const m = line.match(/^( +)/);
  const n = m ? m[1]!.length : 0;
  if (n < minIndent) minIndent = n;
}
if (!Number.isFinite(minIndent)) minIndent = 0;
const dedented = lines.map((l) => l.slice(minIndent)).join("\n");

// Drop MDX-only `{/* ... */}` comments — they render as text in GH releases.
const cleaned = dedented.replace(/\{\/\*[\s\S]*?\*\/\}\s*\n?/g, "");

process.stdout.write(`${cleaned}\n`);
