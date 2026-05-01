#!/usr/bin/env bun
// Sync `metadata.version` in every skills/*/SKILL.md to the version of the
// `tangly` npm package. Run automatically from the root `version` script
// after `changeset version` bumps package versions, so the version commit
// captures both package and skill bumps in one diff.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

const repoRoot = resolve(import.meta.dirname, "..");
const tanglyPkg = JSON.parse(
  readFileSync(resolve(repoRoot, "packages/tangly/package.json"), "utf8"),
) as { version: string };
const targetVersion = tanglyPkg.version;

const glob = new Glob("skills/*/SKILL.md");
let updated = 0;
let alreadyInSync = 0;
let missingField = 0;

for await (const rel of glob.scan({ cwd: repoRoot })) {
  const path = resolve(repoRoot, rel);
  const body = readFileSync(path, "utf8");

  const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) {
    console.warn(`! ${rel}: no YAML frontmatter — skipping`);
    missingField++;
    continue;
  }
  const fm = fmMatch[1]!;
  if (!/^\s+version:\s*\S/m.test(fm)) {
    console.warn(`! ${rel}: no \`version:\` under metadata — skipping`);
    missingField++;
    continue;
  }
  const newFm = fm.replace(/^(\s+version:\s*).*$/m, `$1${targetVersion}`);
  if (newFm === fm) {
    console.log(`= ${rel} (already ${targetVersion})`);
    alreadyInSync++;
    continue;
  }
  const next = body.replace(fmMatch[0], `---\n${newFm}\n---\n`);
  writeFileSync(path, next, "utf8");
  console.log(`✓ ${rel} → ${targetVersion}`);
  updated++;
}

const parts = [
  `${updated} updated`,
  `${alreadyInSync} already in sync`,
  ...(missingField ? [`${missingField} missing version field`] : []),
];
console.log(`Sync result: ${parts.join(", ")} (target ${targetVersion}).`);
if (missingField > 0) process.exit(1);
