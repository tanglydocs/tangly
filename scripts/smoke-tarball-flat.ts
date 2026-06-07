#!/usr/bin/env bun
// Pack every workspace package, install **only `tangly`** as a direct
// dep (workspace pkgs come in transitively, like a real `npm i tangly`),
// then run init + build. Catches dep-hoisting bugs that the full-graph
// pack-install-smoke (scripts/smoke-tarball.ts) hides — the realistic
// `npm i -g tangly` install flattens differently than installing every
// workspace pkg as a direct dep.
//
// History: 0.0.8 → 0.0.10 each shipped with installer-smoke red because
// `piccolore` and `unist-util-visit-parents/do-not-use-color` failed to
// hoist. This script reproduces that flat layout pre-publish so fixes
// land in the same release that introduces them.
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

const work = mkdtempSync(join(tmpdir(), "tangly-tarball-flat-"));
const stage = join(work, "stage");
const registry = join(work, "registry");
const installDir = join(work, "install");
const projectDir = join(installDir, "project");
mkdirSync(stage, { recursive: true });
mkdirSync(registry, { recursive: true });
mkdirSync(installDir, { recursive: true });
log(`tmp: ${work}`);

const pkgInfo = workspacePkgs.map((rel) => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, rel, "package.json"), "utf8"));
  return { rel, name: pkg.name as string, version: pkg.version as string };
});
const canonicalVersion = pkgInfo.find((p) => p.name === "tangly")?.version;
if (!canonicalVersion) fail("could not read tangly version");
const internalNames = new Set(pkgInfo.map((p) => p.name));
// Packages now version independently, so each internal dep resolves to its own
// version (not one canonical version). Mirrors release.yml's caret rewrite.
const versionByName = new Map(pkgInfo.map((p) => [p.name, p.version]));

step("stage packages with workspace:* rewritten to caret ranges");
for (const { rel, name } of pkgInfo) {
  const src = join(repoRoot, rel);
  const dst = join(stage, rel);
  mkdirSync(dst, { recursive: true });
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
        block[dep] = `^${versionByName.get(dep)!}`;
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

const tarballFor = (name: string): string => {
  const safeName = name.replace(/^@/, "").replace(/\//g, "-");
  const match = tarballs.find((t) => t.startsWith(`${safeName}-`));
  if (!match) fail(`no tarball matched ${name} (looked for ${safeName}-*.tgz)`);
  return join(registry, match);
};

step("write install scaffold (only tangly direct; workspace pkgs via overrides)");
// Direct dep: tangly only. The realistic `npm i -g tangly` shape.
// Overrides remap every @tanglydocs/* transitive (whatever version the
// staged tangly tarball pins) to the local tarball, so we never pull
// from the public registry for workspace pkgs while still keeping a
// flat graph rooted at tangly.
const overrides: Record<string, string> = {};
for (const { name } of pkgInfo) {
  if (name === "tangly") continue;
  overrides[name] = `file:${tarballFor(name)}`;
}
writeFileSync(
  join(installDir, "package.json"),
  `${JSON.stringify(
    {
      name: "tangly-tarball-flat-smoke",
      version: "0.0.0",
      private: true,
      dependencies: { tangly: `file:${tarballFor("tangly")}` },
      overrides,
    },
    null,
    2,
  )}\n`,
);

step("npm install (flat: tangly only as direct dep)");
run("npm", ["install", "--no-audit", "--no-fund", "--min-release-age=0", "--loglevel=warn"], {
  cwd: installDir,
  env: { NPM_CONFIG_MIN_RELEASE_AGE: "0" },
});

step("verify hoisting of historically-broken transitive deps");
// The install must hoist these to the consumer's top-level node_modules
// or Node ESM's parent-walk from dist/.prerender/chunks/*.mjs can't see
// them. Validating directly is a stronger signal than waiting for build
// to fail.
const mustHoist = [
  { dep: "piccolore", required: ">=0.1.0" },
  { dep: "unist-util-visit-parents", required: ">=6" },
];
for (const { dep, required } of mustHoist) {
  const p = join(installDir, "node_modules", dep, "package.json");
  if (!existsSync(p)) fail(`${dep} not hoisted to top-level node_modules (need ${required})`);
  const v = JSON.parse(readFileSync(p, "utf8")).version as string;
  log(`  ✓ ${dep}@${v}`);
}

const tanglyBin = join(installDir, "node_modules", ".bin", "tangly");
if (!existsSync(tanglyBin)) fail(`tangly bin missing at ${tanglyBin}`);

step("tangly --version");
run(tanglyBin, ["--version"], { cwd: installDir });

mkdirSync(projectDir, { recursive: true });
writeFileSync(join(projectDir, "introduction.md"), "---\ntitle: Introduction\n---\n\n# Hello\n");

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

log(`\n✓ tarball-flat smoke passed (${work})`);

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
