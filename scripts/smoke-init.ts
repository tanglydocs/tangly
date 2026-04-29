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

step("build --out dist");
runCli(["build", "--out", "dist", "--root", projectDir], { TANGLY_USER_ROOT: projectDir });
assertExists(join(projectDir, "dist", "index.html"));

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

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}
