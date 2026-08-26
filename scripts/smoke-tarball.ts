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
import { PUBLISHABLE_DIRS } from "./publishable-packages.ts";

const repoRoot = resolve(import.meta.dirname, "..");

const workspacePkgs = PUBLISHABLE_DIRS;

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
// Packages now version independently, so each internal dep resolves to its own
// version (not one canonical version). Mirrors release.yml's caret rewrite.
const versionByName = new Map(pkgInfo.map((p) => [p.name, p.version]));

step("stage packages with workspace:* rewritten to caret ranges");
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
// The fence is load-bearing: it is what proves the markdown pipeline ran.
writeFileSync(
  join(projectDir, "introduction.md"),
  "---\ntitle: Introduction\n---\n\n# Hello\n\n```bash\necho hello\n```\n",
);
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

// A silently-skipped markdown pipeline still builds, still exits 0, and still
// writes every page — it just emits bare <pre> with no highlighting and no
// copy button. Astro 7 did exactly that when the plugins stayed on `mdx()`
// instead of `markdown.processor`. The fixture above has one fence, so at
// least one built page must carry the chrome. Scan them all: which route the
// fence lands on depends on how `init` scaffolds the home page.
const pages: string[] = [];
for (const stack = [join(projectDir, "dist")]; stack.length > 0; ) {
  for (const entry of readdirSync(stack.pop()!, { withFileTypes: true })) {
    const full = join(entry.parentPath, entry.name);
    if (entry.isDirectory()) stack.push(full);
    else if (entry.name.endsWith(".html")) pages.push(full);
  }
}
const highlighted = pages.filter((f) => {
  const html = readFileSync(f, "utf8");
  return html.includes("tangly-code-figure") && html.includes('class="shiki');
});
if (highlighted.length === 0) {
  fail(
    `no highlighted code figure in ${pages.length} built page(s) — the remark/rehype pipeline did not run.\n` +
      "  Check `markdown.processor` in runtime/astro.config.mjs.",
  );
}
log(`  ✓ code chrome present (${highlighted.length}/${pages.length} pages)`);

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
