#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const cli = resolve(repoRoot, "packages/tangly/bin/tangly.js");

if (!existsSync(cli)) {
  fail(`CLI not found at ${cli} — run \`bun run build\` first`);
}

const work = mkdtempSync(join(tmpdir(), "tangly-smoke-"));
log(`tmp: ${work}`);

const projectDir = join(work, "project");
mkdirSync(projectDir, { recursive: true });

writeFileSync(
  join(projectDir, "introduction.md"),
  "---\ntitle: Introduction\n---\n\n# Hello\n\nWelcome.\n",
);
mkdirSync(join(projectDir, "guides"), { recursive: true });
writeFileSync(
  join(projectDir, "guides", "quickstart.md"),
  "---\ntitle: Quickstart\n---\n\n# Quickstart\n\nLet's go.\n",
);

step("init --from <projectDir> (synthesize docs.json from existing files)");
runCli(["init", "--from", projectDir, projectDir]);
assertExists(join(projectDir, "docs.json"));

step("migrate --yes");
runCli(["migrate", "--yes", "--root", projectDir]);

// Drop deploy-meta files + custom robots.txt + .tanglyignore + .gitignore to
// exercise the copy-everything passthrough + ignore stack.
writeFileSync(join(projectDir, "CNAME"), "tangly.dev\n");
writeFileSync(join(projectDir, "_redirects"), "/old-page  /new-page  301\n");
writeFileSync(join(projectDir, "robots.txt"), "User-agent: BadBot\nDisallow: /\n");
writeFileSync(join(projectDir, ".tanglyignore"), "secret.txt\n");
writeFileSync(join(projectDir, "secret.txt"), "should be excluded\n");
writeFileSync(join(projectDir, ".gitignore"), "private/\n");
mkdirSync(join(projectDir, "private"), { recursive: true });
writeFileSync(join(projectDir, "private", "keys.json"), "{}\n");

step("build --out dist");
runCli(["build", "--out", "dist", "--root", projectDir], { TANGLY_USER_ROOT: projectDir });
assertExists(join(projectDir, "dist", "index.html"));

step("passthrough: CNAME shipped");
assertExists(join(projectDir, "dist", "CNAME"));

step("passthrough: _redirects shipped");
assertExists(join(projectDir, "dist", "_redirects"));

step("user robots.txt preserved (generator skipped)");
assertContains(join(projectDir, "dist", "robots.txt"), "BadBot");

step(".tanglyignore exclusion applied");
assertNotExists(join(projectDir, "dist", "secret.txt"));

step(".gitignore additivity");
assertNotExists(join(projectDir, "dist", "private"));

log(`\n✓ smoke passed (${work})`);

function step(name: string): void {
  log(`\n→ ${name}`);
}

function runCli(args: string[], env: Record<string, string> = {}): void {
  const result = spawnSync("bun", [cli, ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`tangly ${args.join(" ")} exited ${result.status}`);
}

function assertExists(path: string): void {
  if (!existsSync(path)) fail(`expected ${path} to exist`);
  log(`  ✓ ${path}`);
}

function assertNotExists(path: string): void {
  if (existsSync(path)) fail(`expected ${path} to NOT exist`);
  log(`  ✓ absent ${path}`);
}

function assertContains(path: string, needle: string): void {
  if (!existsSync(path)) fail(`expected ${path} to exist`);
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const body = readFileSync(path, "utf8");
  if (!body.includes(needle)) {
    fail(`expected ${path} to contain "${needle}", got:\n${body.slice(0, 200)}`);
  }
  log(`  ✓ ${path} contains "${needle}"`);
}

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}
