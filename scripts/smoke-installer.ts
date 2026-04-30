#!/usr/bin/env bun
// Verify install.sh end-to-end: writes a wrapper that pins to the npm
// `tangly@latest`, runs `init` + `build` through the wrapper, asserts
// the dist/ output. Mirrors what a curl-pipe-bash user does on day one.
//
// Args:
//   --pm <bun|npm>   force runner (default: auto)
//
// Reuses the published tangly@latest from npm — does NOT pack the
// workspace, since install.sh resolves from the registry. The
// pack-install-smoke job covers locally-packed flow separately.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const installer = resolve(repoRoot, "install.sh");

if (!existsSync(installer)) fail(`install.sh not found at ${installer}`);

const args = process.argv.slice(2);
let pmFlag: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pm" && args[i + 1]) {
    pmFlag = args[i + 1];
    i++;
  }
}

const work = mkdtempSync(join(tmpdir(), "tangly-installer-smoke-"));
const binDir = join(work, "bin");
const projectDir = join(work, "project");
log(`tmp: ${work}`);

step("install.sh --bin-dir <tmp>/bin");
const installArgs = ["--bin-dir", binDir];
if (pmFlag) installArgs.push("--pm", pmFlag);
run(installer, installArgs);

const wrapper = join(binDir, "tangly");
if (!existsSync(wrapper)) fail(`wrapper not written at ${wrapper}`);
log(`  ✓ wrapper exists: ${wrapper}`);

step("wrapper contents sanity");
const wrapperBody = readFileSync(wrapper, "utf8");
if (!/tangly@\d+\.\d+\.\d+/.test(wrapperBody)) {
  fail(`wrapper missing pinned version:\n${wrapperBody}`);
}
log("  ✓ wrapper has a pinned tangly@<version>");

step("tangly --version (via wrapper)");
run(wrapper, ["--version"]);

mkdirSync(projectDir, { recursive: true });
writeFileSync(join(projectDir, "introduction.md"), "---\ntitle: Introduction\n---\n\n# Hello\n");

step("tangly init --from <projectDir>");
run(wrapper, ["init", "--from", projectDir, projectDir]);
if (!existsSync(join(projectDir, "docs.json"))) fail("init did not produce docs.json");
log("  ✓ docs.json");

step("tangly build --out dist (via wrapper)");
run(wrapper, ["build", "--out", "dist", "--root", projectDir], { cwd: projectDir });
if (!existsSync(join(projectDir, "dist", "index.html"))) {
  fail("build did not produce dist/index.html");
}
log("  ✓ dist/index.html");

log(`\n✓ installer smoke passed (${work})`);

function step(name: string): void {
  log(`\n→ ${name}`);
}
function run(cmd: string, cmdArgs: string[], opts: { cwd?: string } = {}): void {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    cwd: opts.cwd,
  });
  if (result.status !== 0) {
    fail(`${cmd} ${cmdArgs.join(" ")} exited ${result.status}`);
  }
}
function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}
function fail(msg: string): never {
  process.stderr.write(`✗ ${msg}\n`);
  process.exit(1);
}
