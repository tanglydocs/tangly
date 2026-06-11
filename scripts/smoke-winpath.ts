#!/usr/bin/env bun
// Windows cross-drive regression gate for issue #6.
//
// When a user's project lives on a different drive than the installed `tangly`
// runtime (project on E:\, global install on C:\), Astro's content layer stores
// absolute drive-letter paths as deferred-module fileNames; `new URL("E:/…",
// root)` then reads `E:` as a URL *scheme* → ERR_INVALID_URL_SCHEME → blank/500
// page. The ubuntu/macos CI legs can't see this — it needs two drive letters.
//
// `subst` maps a free drive letter to a directory. Node's `path.relative` keys
// off the *letter*, not the physical volume, so a subst-ed drive reproduces the
// cross-drive crash deterministically on any Windows runner (no admin needed).
// Pre-fix this build crashes; post-fix it renders. Self-skips off Windows so it
// is safe to invoke from any OS.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (process.platform !== "win32") {
  log("· not Windows — skipping cross-drive gate (issue #6 is Windows-only)");
  process.exit(0);
}

const repoRoot = resolve(import.meta.dirname, "..");
const cli = resolve(repoRoot, "packages/tangly/bin/tangly.js");
if (!existsSync(cli)) fail(`CLI not found at ${cli} — run \`bun run build\` first`);

const OVERVIEW_MARKER = "TANGLY_WINPATH_OVERVIEW_BODY";
const INDEX_MARKER = "TANGLY_WINPATH_INDEX_BODY";

const work = mkdtempSync(join(tmpdir(), "tangly-winpath-"));
log(`tmp: ${work}`);

// Mirror the reported page: an MDX page with a component and body text under
// it, under api-reference/ (where the user saw the blank render).
writeFileSync(join(work, "index.mdx"), `---\ntitle: Home\n---\n\n# Home\n\n${INDEX_MARKER}\n`);
mkdirSync(join(work, "api-reference"), { recursive: true });
writeFileSync(
  join(work, "api-reference", "overview.mdx"),
  `---\ntitle: Overview\n---\n\n# Overview\n\n<Note>Heads up.</Note>\n\n${OVERVIEW_MARKER}\n`,
);

// Synthesize docs.json from the files (same scaffolder smoke-init uses). Runs
// on the real path — init doesn't trigger the content-render path; only build
// does, which is what must run cross-drive.
step("init --from (synthesize docs.json)");
runCli(["init", "--from", work, work]);
assertExists(join(work, "docs.json"));

// Pick a free drive letter and map it to the project dir.
const drive = pickFreeDrive();
const driveRoot = `${drive}:\\`;
step(`subst ${drive}: → ${work}  (cross-drive: runtime lives on ${repoRoot.slice(0, 2)})`);
subst([`${drive}:`, work]);

try {
  // Build with --root on the subst drive. The runtime is on the checkout
  // drive, so root↔content are cross-drive — the exact issue #6 trigger.
  step(`build --root ${driveRoot} (cross-drive render)`);
  runCli(["build", "--out", "dist", "--root", driveRoot], { TANGLY_USER_ROOT: driveRoot });

  const dist = join(work, "dist");
  assertExists(join(dist, "index.html"));
  // The crash blanks the page body (or fails the build). Assert both pages'
  // body markers actually rendered into the static HTML.
  step("assert page bodies rendered (not blank)");
  assertHtmlContains(dist, INDEX_MARKER);
  assertHtmlContains(dist, OVERVIEW_MARKER);

  log(`\n✓ windows cross-drive smoke passed (${work})`);
} finally {
  // Always release the drive mapping, even on failure.
  subst(["/d", `${drive}:`], { allowFail: true });
}

function pickFreeDrive(): string {
  for (const letter of ["Z", "Y", "X", "W", "V", "T"]) {
    if (!existsSync(`${letter}:\\`)) return letter;
  }
  fail("no free drive letter available for subst");
}

function subst(args: string[], opts: { allowFail?: boolean } = {}): void {
  const result = spawnSync("subst", args, { stdio: "inherit" });
  if (result.status !== 0 && !opts.allowFail) {
    fail(`subst ${args.join(" ")} exited ${result.status}`);
  }
}

function runCli(args: string[], env: Record<string, string> = {}): void {
  const result = spawnSync("bun", [cli, ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`tangly ${args.join(" ")} exited ${result.status}`);
}

/** Recursively search every .html under `dir` for `needle`. */
function assertHtmlContains(dir: string, needle: string): void {
  if (htmlContains(dir, needle)) {
    log(`  ✓ rendered HTML contains "${needle}"`);
    return;
  }
  fail(
    `expected some .html under ${dir} to contain "${needle}" (blank render → issue #6 regression)`,
  );
}

function htmlContains(dir: string, needle: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (htmlContains(full, needle)) return true;
    } else if (entry.name.endsWith(".html") && readFileSync(full, "utf8").includes(needle)) {
      return true;
    }
  }
  return false;
}

function step(name: string): void {
  log(`\n→ ${name}`);
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
