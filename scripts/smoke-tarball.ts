#!/usr/bin/env bun
// Pack every workspace package, install them into a clean tmp dir
// outside the workspace, then run init + build. Reproduces what a user
// gets from `bunx tangly` / `npx tangly` — catches resolution bugs that
// the in-workspace smoke (scripts/smoke-init.ts) hides via hoisting.
//
// Mirrors release.yml's pre-publish rewrite of workspace:* → concrete
// versions, but in a tmp working copy so the source tree stays clean.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

const workspacePkgs = [
  "packages/schema",
  "packages/theme-ui",
  "packages/theme-tang",
  "packages/theme-pith",
  "packages/theme-pip",
  "packages/theme-readable",
  "packages/theme-geist",
  "packages/tangly",
] as const;

const work = mkdtempSync(join(tmpdir(), "tangly-tarball-"));
const stage = join(work, "stage"); // tmp copy of pkgs with workspace:* rewritten
const registry = join(work, "registry");
const installDir = join(work, "install");
const projectDir = join(installDir, "project");
mkdirSync(stage, { recursive: true });
mkdirSync(registry, { recursive: true });
mkdirSync(installDir, { recursive: true });
log(`tmp: ${work}`);

// Read all pkg names + the canonical version (from packages/tangly).
const pkgInfo = workspacePkgs.map((rel) => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, rel, "package.json"), "utf8"));
  return { rel, name: pkg.name as string, version: pkg.version as string };
});
const canonicalVersion = pkgInfo.find((p) => p.name === "tangly")?.version;
if (!canonicalVersion) fail("could not read tangly version");
const internalNames = new Set(pkgInfo.map((p) => p.name));

step("stage packages with workspace:* rewritten to concrete versions");
for (const { rel, name } of pkgInfo) {
  const src = join(repoRoot, rel);
  const dst = join(stage, rel);
  mkdirSync(dst, { recursive: true });
  // Copy the published surface only — package.json + the files the pkg
  // declares. To keep the script simple we copy everything except node_modules.
  cpSync(src, dst, {
    recursive: true,
    filter: (p) => !p.includes(`${rel}/node_modules`) && !p.endsWith("/node_modules"),
  });

  const pkgJsonPath = join(dst, "package.json");
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const block = pkg[field];
    if (!block) continue;
    for (const dep of Object.keys(block)) {
      if (internalNames.has(dep)) {
        block[dep] = canonicalVersion;
      }
    }
  }
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  log(`  staged ${name}`);
}

step("pack all staged packages");
for (const { rel, name } of pkgInfo) {
  const dir = join(stage, rel);
  log(`  packing ${name}`);
  run("bun", ["pm", "pack", "--destination", registry], { cwd: dir });
}

const tarballs = readdirSync(registry).filter((f) => f.endsWith(".tgz"));
if (tarballs.length !== workspacePkgs.length) {
  fail(`expected ${workspacePkgs.length} tarballs, got ${tarballs.length}`);
}
log(`  packed ${tarballs.length} tarballs`);

step("write install scaffold (npm + file: deps)");
// Resolve every workspace pkg via file: against the local tarball. npm
// builds the full graph from these without touching the public registry.
// Mirrors how the graph looks post-publish (concrete versions, no workspace:*).
const fileDeps: Record<string, string> = {};
for (const { name } of pkgInfo) {
  const safeName = name.replace(/^@/, "").replace(/\//g, "-");
  const match = tarballs.find((t) => t.startsWith(`${safeName}-`));
  if (!match) fail(`no tarball matched ${name} (looked for ${safeName}-*.tgz)`);
  fileDeps[name] = `file:${join(registry, match)}`;
}

writeFileSync(
  join(installDir, "package.json"),
  `${JSON.stringify(
    {
      name: "tangly-tarball-smoke",
      version: "0.0.0",
      private: true,
      dependencies: fileDeps,
    },
    null,
    2,
  )}\n`,
);

step("npm install (resolves the full graph from local tarballs)");
// --min-release-age=0: bypass any min-release-age inherited from a user's
// .npmrc. We want the smoke to test the actual published graph, not a
// date-windowed view of it.
run("npm", ["install", "--no-audit", "--no-fund", "--min-release-age=0", "--loglevel=warn"], {
  cwd: installDir,
  env: { NPM_CONFIG_MIN_RELEASE_AGE: "0" },
});

const tanglyBin = join(installDir, "node_modules", ".bin", "tangly");
if (!existsSync(tanglyBin)) fail(`tangly bin missing at ${tanglyBin}`);

step("tangly --version");
run(tanglyBin, ["--version"], { cwd: installDir });

mkdirSync(projectDir, { recursive: true });
writeFileSync(join(projectDir, "introduction.md"), "---\ntitle: Introduction\n---\n\n# Hello\n");
mkdirSync(join(projectDir, "guides"), { recursive: true });
writeFileSync(
  join(projectDir, "guides", "quickstart.md"),
  "---\ntitle: Quickstart\n---\n\n# Quickstart\n",
);

step("tangly init --from <projectDir> project");
run(tanglyBin, ["init", "--from", projectDir, projectDir], { cwd: installDir });

step("tangly build --out dist");
run(tanglyBin, ["build", "--out", "dist", "--root", projectDir], {
  cwd: projectDir,
  env: { TANGLY_USER_ROOT: projectDir },
});

const indexHtml = join(projectDir, "dist", "index.html");
if (!existsSync(indexHtml)) fail(`build did not produce ${indexHtml}`);
log(`  ✓ ${indexHtml}`);

log(`\n✓ tarball smoke passed (${work})`);

function step(name: string): void {
  log(`\n→ ${name}`);
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): void {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} exited ${result.status}`);
}

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}
