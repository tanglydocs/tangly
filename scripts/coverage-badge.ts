#!/usr/bin/env bun
// Aggregate vitest `coverage-summary.json` across packages, write a Shields
// `endpoint` JSON for the README coverage badge to the path given as argv[2].

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

interface Summary {
  total: { lines: { covered: number; total: number } };
}

const repoRoot = resolve(import.meta.dirname, "..");
const outPath = process.argv[2];
if (!outPath) {
  console.error("usage: coverage-badge.ts <output-json-path>");
  process.exit(1);
}

const glob = new Glob("packages/*/coverage/coverage-summary.json");
let covered = 0;
let total = 0;
let files = 0;
for (const rel of glob.scanSync(repoRoot)) {
  const summary = JSON.parse(readFileSync(resolve(repoRoot, rel), "utf8")) as Summary;
  covered += summary.total.lines.covered;
  total += summary.total.lines.total;
  files++;
}

if (files === 0) {
  console.error("no coverage-summary.json files found");
  process.exit(1);
}

const pct = total === 0 ? 0 : Math.round((covered / total) * 1000) / 10;
const color =
  pct >= 90
    ? "brightgreen"
    : pct >= 80
      ? "green"
      : pct >= 70
        ? "yellowgreen"
        : pct >= 60
          ? "yellow"
          : "orange";

const payload = {
  schemaVersion: 1,
  label: "coverage",
  message: `${pct}%`,
  color,
};

writeFileSync(outPath, JSON.stringify(payload));
console.log(`coverage ${pct}% (${covered}/${total} lines, ${files} pkgs) → ${outPath}`);
