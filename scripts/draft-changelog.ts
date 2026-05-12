#!/usr/bin/env bun
// Draft a new <Update> block for the next release and prepend it to
// docs/changelog.mdx. Reads .changeset/*.md (if any) plus `git log` since the
// last tag, auto-links PR/issue/commit refs, and infers tags from
// conventional-commit prefixes.
//
// Usage:
//   bun run scripts/draft-changelog.ts                # default patch bump
//   bun run scripts/draft-changelog.ts --bump minor
//   bun run scripts/draft-changelog.ts --bump prerelease --pre rc
//
// After running: edit docs/changelog.mdx prose, commit, then trigger the
// release workflow with the matching bump.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Bump = "patch" | "minor" | "major" | "prerelease";

const repoRoot = resolve(import.meta.dirname, "..");
const changelogPath = resolve(repoRoot, "docs/changelog.mdx");
const tanglyPkgPath = resolve(repoRoot, "packages/tangly/package.json");
const changesetDir = resolve(repoRoot, ".changeset");

function parseArgs(argv: string[]): { bump: Bump; pre: string } {
  let bump: Bump = "patch";
  let pre = "rc";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bump" && argv[i + 1]) {
      const v = argv[++i] as Bump;
      if (!["patch", "minor", "major", "prerelease"].includes(v)) {
        console.error(`bad --bump: ${v}`);
        process.exit(1);
      }
      bump = v;
    } else if (a === "--pre" && argv[i + 1]) {
      pre = argv[++i]!;
    }
  }
  return { bump, pre };
}

function bumpVersion(current: string, bump: Bump, preId: string): string {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) throw new Error(`bad semver: ${current}`);
  let maj = +m[1]!;
  let min = +m[2]!;
  let pat = +m[3]!;
  let pre: string | undefined = m[4];
  if (bump === "major") {
    maj++;
    min = 0;
    pat = 0;
    pre = undefined;
  } else if (bump === "minor") {
    min++;
    pat = 0;
    pre = undefined;
  } else if (bump === "patch") {
    pat++;
    pre = undefined;
  } else {
    if (pre && pre.startsWith(`${preId}.`)) {
      const n = parseInt(pre.slice(preId.length + 1), 10);
      pre = `${preId}.${Number.isFinite(n) ? n + 1 : 0}`;
    } else {
      pat++;
      pre = `${preId}.0`;
    }
  }
  return `${maj}.${min}.${pat}` + (pre ? `-${pre}` : "");
}

function git(args: string[]): string | null {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trimEnd();
}

function lastTag(): string | null {
  return git(["describe", "--tags", "--abbrev=0"]);
}

function ghRepoSlug(): string {
  const url = git(["config", "--get", "remote.origin.url"]);
  if (url) {
    const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    if (m) return m[1]!;
  }
  return "tanglydocs/tangly";
}

interface Commit {
  short: string;
  full: string;
  subject: string;
  type: string | null;
  scope: string | null;
  // GH numeric refs (PR or issue — GH `/issues/N` URL resolves to PR if applicable).
  refs: number[];
}

const TYPE_RX =
  /^(feat|fix|perf|refactor|docs|build|chore|test|style|ci|revert|hotfix)(?:\(([^)]+)\))?!?:\s*(.+)$/;

function parseCommit(short: string, full: string, subject: string, body: string): Commit {
  const m = subject.match(TYPE_RX);
  const type = m ? m[1]! : null;
  const scope = m && m[2] ? m[2] : null;
  const cleanSubject = m ? m[3]! : subject;
  // Collect numeric refs from both subject (`(#N)` squash markers + bare `#N`)
  // and the trailing body (`Fixes #N`, `Closes #N`, etc.).
  const refs: number[] = [];
  const seen = new Set<number>();
  const haystack = `${cleanSubject}\n${body}`;
  for (const ref of haystack.matchAll(/(?<![\w-])#(\d+)\b/g)) {
    const n = +ref[1]!;
    if (!seen.has(n)) {
      seen.add(n);
      refs.push(n);
    }
  }
  return {
    short,
    full,
    subject: cleanSubject.replace(/\s*\(#\d+\)/g, "").trim(),
    type,
    scope,
    refs,
  };
}

function commitsSince(since: string | null): Commit[] {
  const range = since ? `${since}..HEAD` : "HEAD";
  // %x1f is a record separator we use to keep multi-line bodies intact within
  // a tab-delimited line.
  const out = git(["log", range, "--pretty=format:%h%x09%H%x09%s%x1f%b%x1e"]);
  if (!out) return [];
  return out
    .split("\x1e")
    .map((rec) => rec.replace(/^\n/, ""))
    .filter(Boolean)
    .map((line) => {
      const [short, full, subjectAndBody] = line.split("\t");
      const [subject, ...bodyParts] = (subjectAndBody ?? "").split("\x1f");
      const body = bodyParts.join("\x1f");
      return parseCommit(short!, full!, subject!, body);
    });
}

interface ChangesetEntry {
  bumps: Record<string, "patch" | "minor" | "major">;
  summary: string;
}

function readChangesets(): ChangesetEntry[] {
  if (!existsSync(changesetDir)) return [];
  const files = readdirSync(changesetDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  const entries: ChangesetEntry[] = [];
  for (const f of files) {
    const body = readFileSync(resolve(changesetDir, f), "utf8");
    const m = body.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) continue;
    const fm = m[1]!;
    const summary = m[2]!.trim();
    const bumps: ChangesetEntry["bumps"] = {};
    for (const line of fm.split("\n")) {
      const lm = line.match(/^"([^"]+)":\s*(patch|minor|major)\s*$/);
      if (lm) bumps[lm[1]!] = lm[2] as "patch" | "minor" | "major";
    }
    entries.push({ bumps, summary });
  }
  return entries;
}

function inferTags(commits: Commit[], changesets: ChangesetEntry[]): string[] {
  const tags = new Set<string>();
  const interesting = new Set(["feat", "fix", "perf", "refactor", "docs"]);
  for (const c of commits) {
    if (c.type && interesting.has(c.type)) tags.add(c.type);
  }
  for (const cs of changesets) {
    for (const lvl of Object.values(cs.bumps)) {
      if (lvl === "major") tags.add("breaking");
      else if (lvl === "minor") tags.add("feat");
    }
  }
  return [...tags].toSorted();
}

// MDX treats `<` adjacent to non-space as the start of a JSX tag and `{` as an
// expression. Commit subjects like `HMR <250ms` or `{ foo }` would break the
// build. Escape conservatively; rendered output reads the same.
function escapeMdx(s: string): string {
  return s.replace(/</g, "&lt;").replace(/\{/g, "&#123;");
}

function linkifyCommit(c: Commit, repo: string): string {
  const baseUrl = `https://github.com/${repo}`;
  const refs: string[] = [];
  for (const n of c.refs) {
    // /issues/N redirects to the PR when N happens to be a PR — works for both.
    refs.push(`[#${n}](${baseUrl}/issues/${n})`);
  }
  refs.push(`[\`${c.short}\`](${baseUrl}/commit/${c.full})`);
  const prefix = c.type ? (c.scope ? `${c.type}(${c.scope}): ` : `${c.type}: `) : "";
  return `- ${prefix}${escapeMdx(c.subject)} (${refs.join(", ")})`;
}

function groupCommits(commits: Commit[]): Map<string, Commit[]> {
  const order = [
    "feat",
    "fix",
    "perf",
    "refactor",
    "docs",
    "build",
    "ci",
    "chore",
    "test",
    "style",
    "revert",
    "hotfix",
    "other",
  ];
  const groups = new Map<string, Commit[]>();
  for (const k of order) groups.set(k, []);
  for (const c of commits) {
    const key = c.type && groups.has(c.type) ? c.type : "other";
    groups.get(key)!.push(c);
  }
  for (const [k, v] of groups) if (v.length === 0) groups.delete(k);
  return groups;
}

const TYPE_HEADINGS: Record<string, string> = {
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactor",
  docs: "Docs",
  build: "Build",
  ci: "CI",
  chore: "Chore",
  test: "Tests",
  style: "Style",
  revert: "Reverts",
  hotfix: "Hotfix",
  other: "Other",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildBlock(opts: {
  version: string;
  date: string;
  tags: string[];
  changesets: ChangesetEntry[];
  commits: Commit[];
  repo: string;
}): string {
  const { version, date, tags, changesets, commits, repo } = opts;
  const lines: string[] = [];
  const tagsAttr = tags.length > 0 ? ` tags={${JSON.stringify(tags)}}` : "";
  lines.push(`<Update label="v${version}" description="${date}"${tagsAttr}>`);
  lines.push(`  ## Highlights`);
  lines.push(`  {/* TODO: prose summary — what's new, why it matters */}`);
  lines.push(``);
  if (changesets.length > 0) {
    lines.push(`  ## Notes`);
    for (const cs of changesets) {
      const summary = cs.summary
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ");
      lines.push(`  - ${summary}`);
    }
    lines.push(``);
  }
  if (commits.length > 0) {
    lines.push(`  ## Changes`);
    const groups = groupCommits(commits);
    for (const [type, cs] of groups) {
      lines.push(``);
      lines.push(`  ### ${TYPE_HEADINGS[type] ?? type}`);
      for (const c of cs) {
        lines.push(`  ${linkifyCommit(c, repo)}`);
      }
    }
    lines.push(``);
  }
  lines.push(`</Update>`);
  return lines.join("\n");
}

const SCAFFOLD_HEADER = `---
title: Changelog
description: Release notes for Tangly.
---

Notable changes per release. Each entry is authored as an [\`<Update>\`](/reference/components/callouts#update) block, the same component you can use in your own docs.

`;

function prependBlock(block: string): void {
  if (!existsSync(changelogPath)) {
    writeFileSync(changelogPath, `${SCAFFOLD_HEADER}${block}\n`, "utf8");
    return;
  }
  const current = readFileSync(changelogPath, "utf8");
  // Prefer to slot the new block immediately above the first existing <Update>
  // block so any intro prose stays at the top. Anchor at start-of-line to
  // avoid matching inline-code mentions of `<Update>` in prose.
  const firstUpdate = current.search(/^<Update[\s>]/m);
  if (firstUpdate !== -1) {
    const next = `${current.slice(0, firstUpdate)}${block}\n\n${current.slice(firstUpdate)}`;
    writeFileSync(changelogPath, next, "utf8");
    return;
  }
  // Fallback: no existing <Update> blocks — slot after the frontmatter.
  const fmMatch = current.match(/^---\n[\s\S]*?\n---\n+/);
  if (!fmMatch) {
    writeFileSync(changelogPath, `${SCAFFOLD_HEADER}${block}\n\n${current}`, "utf8");
    return;
  }
  const head = fmMatch[0];
  const rest = current.slice(head.length);
  const next = `${head}${block}\n\n${rest.startsWith("\n") ? rest.slice(1) : rest}`;
  writeFileSync(changelogPath, next, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const tanglyPkg = JSON.parse(readFileSync(tanglyPkgPath, "utf8")) as { version: string };
const next = bumpVersion(tanglyPkg.version, args.bump, args.pre);
const since = lastTag();
const repo = ghRepoSlug();
const commits = commitsSince(since);
const changesets = readChangesets();
const tags = inferTags(commits, changesets);
const block = buildBlock({
  version: next,
  date: todayISO(),
  tags,
  changesets,
  commits,
  repo,
});

prependBlock(block);

console.log(`Drafted v${next} in docs/changelog.mdx`);
console.log(`  since: ${since ?? "(no prior tag)"}`);
console.log(`  commits: ${commits.length}`);
console.log(`  changesets: ${changesets.length}`);
console.log(`  tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`);
console.log(``);
console.log(`Next:`);
console.log(`  1. Edit docs/changelog.mdx — replace the TODO with prose, prune noise.`);
console.log(`  2. git add docs/changelog.mdx && git commit -m "docs(changelog): v${next}"`);
console.log(`  3. Trigger the release workflow with bump=${args.bump}.`);
