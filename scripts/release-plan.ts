#!/usr/bin/env bun
// Compute (and apply) a CHANGED-ONLY release plan for the @tanglydocs monorepo.
//
// Replaces the old "bump every package to one version" model. Detects which
// publishable packages actually changed since their last publish, expands to
// dependents only when a bump escapes their caret range, and emits the exact
// version + publish + dep-rewrite plan the release workflow executes.
//
// Internal deps are published as caret ranges (workspace:* -> ^x.y.z) so a
// theme/schema patch ships solo and tangly picks it up on next install without
// republishing. Source keeps workspace:* — the caret rewrite is working-tree only.
//
// Subcommands:
//   plan            --bump <patch|minor|major|prerelease> [--prerelease-id rc]
//                   [--out <file>]        compute, write JSON (default stdout)
//   apply-versions  --plan <file>         write new versions to the publish set
//   apply-rewrite   --plan <file>         rewrite internal deps -> ^version (all 8)
//
// The plan is computed ONCE (before any package.json mutation) and persisted,
// so apply-* never re-detect against an already-bumped tree.

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

// The last uniform release where every package was published at the same version.
// Baseline for any package not yet independently tagged. Valid until that package
// gets its first `<key>@<version>` tag.
const BOOTSTRAP_BASELINE = "v0.1.6";

// Publishable packages in TOPOLOGICAL order (deps before dependents) — also the
// npm publish order. Private packages (website, template-starter) are excluded:
// never scanned, never published, never cascade into core.
interface PkgDef {
  key: string;
  dir: string;
  name: string;
}
const PUBLISHABLE: readonly PkgDef[] = [
  { key: "schema", dir: "packages/schema", name: "@tanglydocs/schema" },
  { key: "theme-ui", dir: "packages/theme-ui", name: "@tanglydocs/theme-ui" },
  { key: "theme-tang", dir: "packages/theme-tang", name: "@tanglydocs/theme-tang" },
  { key: "theme-pith", dir: "packages/theme-pith", name: "@tanglydocs/theme-pith" },
  { key: "theme-pip", dir: "packages/theme-pip", name: "@tanglydocs/theme-pip" },
  { key: "theme-readable", dir: "packages/theme-readable", name: "@tanglydocs/theme-readable" },
  { key: "theme-geist", dir: "packages/theme-geist", name: "@tanglydocs/theme-geist" },
  { key: "tangly", dir: "packages/tangly", name: "tangly" },
];

// Cascade graph = what CONSUMERS install. devDependencies never reach consumers,
// so a devDep edge must not trigger a republish cascade. (theme-ui → tangly is a
// real *runtime* dep via `resolveSite` from `tangly/site`, so the theme-ui⇄tangly
// cycle is genuine and stays in the graph; minor/major bumps therefore cascade
// broadly. patch never cascades, so the common case is unaffected.)
const RUNTIME_DEP_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"] as const;
// Rewrite touches every field so no published package.json ships `workspace:*`.
const ALL_DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type Bump = "patch" | "minor" | "major" | "prerelease";

export interface PlanPkg {
  key: string;
  dir: string;
  name: string;
  oldVersion: string;
  newVersion: string;
  /** Version other packages should depend on after this release (newVersion if published, else oldVersion). */
  effectiveVersion: string;
  publish: boolean;
  directlyChanged: boolean;
  /** Internal dependency keys (within the publishable set) this package depends on. */
  internalDeps: string[];
}

export interface ReleasePlan {
  bump: Bump;
  prereleaseId: string;
  distTag: string;
  corePublished: boolean;
  tanglyVersion: string;
  tag: string | null;
  anyPublish: boolean;
  /** Publishable keys to npm-publish, in topological order. */
  publish: string[];
  packages: Record<string, PlanPkg>;
}

// ---------------------------------------------------------------------------
// Pure logic (unit-tested)
// ---------------------------------------------------------------------------

/** Bump a semver string. Mirrors the inline logic the workflow used previously. */
export function bumpVersion(cur: string, bump: Bump, prereleaseId = "rc"): string {
  const m = cur.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) throw new Error(`bad semver: ${cur}`);
  let maj = Number(m[1]);
  let min = Number(m[2]);
  let pat = Number(m[3]);
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
  } else if (bump === "prerelease") {
    if (pre && pre.startsWith(`${prereleaseId}.`)) {
      const n = Number.parseInt(pre.slice(prereleaseId.length + 1), 10);
      pre = `${prereleaseId}.${Number.isFinite(n) ? n + 1 : 0}`;
    } else {
      pat++;
      pre = `${prereleaseId}.0`;
    }
  } else {
    throw new Error(`unknown bump: ${bump as string}`);
  }
  return `${maj}.${min}.${pat}` + (pre ? `-${pre}` : "");
}

/** Compare two `maj.min.patch[-pre]` versions: negative if a<b, 0 if equal, positive if a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split("-")[0]!.split(".").map(Number);
  const pb = b.split("-")[0]!.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  // No-prerelease ranks above a prerelease of the same core version.
  const preA = a.includes("-") ? 1 : 0;
  const preB = b.includes("-") ? 1 : 0;
  return preB - preA;
}

/**
 * Reverse-DAG closure: seeds plus every package that transitively depends on a
 * seed. `internalDepsByKey[k]` lists the publishable keys k depends on.
 */
export function reverseClosure(
  seeds: readonly string[],
  internalDepsByKey: Record<string, string[]>,
): Set<string> {
  const result = new Set(seeds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [key, deps] of Object.entries(internalDepsByKey)) {
      if (result.has(key)) continue;
      if (deps.some((d) => result.has(d))) {
        result.add(key);
        grew = true;
      }
    }
  }
  return result;
}

export interface PlanInputPkg {
  key: string;
  dir: string;
  name: string;
  oldVersion: string;
  internalDeps: string[];
  directlyChanged: boolean;
}

/**
 * Pure planner: given per-package versions/deps/changed-flags, compute the full
 * release plan. No git or filesystem access — the IO layer feeds it.
 */
export function planFromInputs(
  inputs: readonly PlanInputPkg[],
  bump: Bump,
  prereleaseId: string,
): ReleasePlan {
  const byKey = new Map(inputs.map((p) => [p.key, p]));
  const internalDepsByKey: Record<string, string[]> = {};
  for (const p of inputs) internalDepsByKey[p.key] = p.internalDeps;

  const directlyChanged = inputs.filter((p) => p.directlyChanged).map((p) => p.key);

  // patch/prerelease stay within a dependent's caret range -> no cascade.
  // minor/major escape it -> dependents must republish to repoint their range.
  // (Assumes every publishable package is >= 0.1.0, where `^0.1.x` absorbs a
  // patch. A 0.0.x package would need a per-dep caret-satisfies check, since
  // `^0.0.x` pins the patch — not a concern while all packages are 0.1.x+.)
  const cascade = bump === "minor" || bump === "major";
  const publishSet = cascade
    ? reverseClosure(directlyChanged, internalDepsByKey)
    : new Set(directlyChanged);

  const directly = new Set(directlyChanged);
  const packages: Record<string, PlanPkg> = {};
  for (const p of inputs) {
    const willPublish = publishSet.has(p.key);
    // Directly-changed packages get the requested bump; dependents pulled in by a
    // cascade only need a patch to repoint their caret range.
    const level: Bump = willPublish ? (directly.has(p.key) ? bump : "patch") : bump;
    const newVersion = willPublish ? bumpVersion(p.oldVersion, level, prereleaseId) : p.oldVersion;
    packages[p.key] = {
      key: p.key,
      dir: p.dir,
      name: p.name,
      oldVersion: p.oldVersion,
      newVersion,
      effectiveVersion: willPublish ? newVersion : p.oldVersion,
      publish: willPublish,
      directlyChanged: p.directlyChanged,
      internalDeps: p.internalDeps,
    };
  }

  // Preserve PUBLISHABLE topological order for the publish list.
  const publish = inputs.filter((p) => publishSet.has(p.key)).map((p) => p.key);
  const corePublished = publishSet.has("tangly");
  const tanglyOld = byKey.get("tangly")?.oldVersion ?? "0.0.0";
  const tanglyVersion = corePublished ? packages.tangly!.newVersion : tanglyOld;

  return {
    bump,
    prereleaseId,
    distTag: bump === "prerelease" ? prereleaseId : "latest",
    corePublished,
    tanglyVersion,
    tag: corePublished ? `v${tanglyVersion}` : null,
    anyPublish: publish.length > 0,
    publish,
    packages,
  };
}

// ---------------------------------------------------------------------------
// IO layer (git + filesystem)
// ---------------------------------------------------------------------------

interface RawPkg {
  json: Record<string, unknown>;
  path: string;
}

function readPkg(dir: string): RawPkg {
  const path = resolve(repoRoot, dir, "package.json");
  return { json: JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>, path };
}

function internalDepKeys(json: Record<string, unknown>, nameToKey: Map<string, string>): string[] {
  const keys = new Set<string>();
  for (const field of RUNTIME_DEP_FIELDS) {
    const block = json[field] as Record<string, string> | undefined;
    if (!block) continue;
    for (const depName of Object.keys(block)) {
      const k = nameToKey.get(depName);
      if (k) keys.add(k);
    }
  }
  return [...keys];
}

function git(args: string[]): { status: number; stdout: string } {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "" };
}

/** Highest `<key>@<version>` tag, else the bootstrap baseline. */
function baselineRef(key: string): string {
  const { stdout } = git(["tag", "--list", `${key}@*`]);
  const versions = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => t.slice(key.length + 1))
    .filter((v) => /^\d+\.\d+\.\d+/.test(v));
  if (versions.length === 0) return BOOTSTRAP_BASELINE;
  const sorted = versions.toSorted(compareVersions);
  return `${key}@${sorted[sorted.length - 1]}`;
}

/** True if the package has real source changes (excluding dist + tests) since base. */
function isDirectlyChanged(dir: string, base: string): boolean {
  const { status } = git([
    "diff",
    "--quiet",
    base,
    "HEAD",
    "--",
    dir,
    `:(exclude)${dir}/dist/**`,
    `:(exclude)${dir}/**/*.test.*`,
  ]);
  if (status === 0) return false; // no diff
  if (status === 1) return true; // diff present
  // status > 1: bad ref / git error. Fail safe: treat as changed and warn.
  console.error(`! git diff failed for ${dir} vs ${base} (status ${status}); treating as changed`);
  return true;
}

function gatherInputs(): PlanInputPkg[] {
  const nameToKey = new Map(PUBLISHABLE.map((p) => [p.name, p.key]));
  return PUBLISHABLE.map((p) => {
    const { json } = readPkg(p.dir);
    const base = baselineRef(p.key);
    return {
      key: p.key,
      dir: p.dir,
      name: p.name,
      oldVersion: json.version as string,
      internalDeps: internalDepKeys(json, nameToKey),
      directlyChanged: isDirectlyChanged(p.dir, base),
    };
  });
}

function computePlan(bump: Bump, prereleaseId: string): ReleasePlan {
  return planFromInputs(gatherInputs(), bump, prereleaseId);
}

// ---------------------------------------------------------------------------
// Apply modes
// ---------------------------------------------------------------------------

function applyVersions(plan: ReleasePlan): void {
  for (const key of plan.publish) {
    const p = plan.packages[key]!;
    const { json, path } = readPkg(p.dir);
    json.version = p.newVersion;
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
    console.error(`${p.name}: ${p.oldVersion} -> ${p.newVersion}`);
  }
}

/** Rewrite internal deps to `^<effectiveVersion>` across ALL publishable packages
 * (working tree only) so both the published tarballs and the smoke graph resolve. */
function applyRewrite(plan: ReleasePlan): void {
  const nameToKey = new Map(PUBLISHABLE.map((p) => [p.name, p.key]));
  for (const def of PUBLISHABLE) {
    const { json, path } = readPkg(def.dir);
    let touched = false;
    for (const field of ALL_DEP_FIELDS) {
      const block = json[field] as Record<string, string> | undefined;
      if (!block) continue;
      for (const depName of Object.keys(block)) {
        const depKey = nameToKey.get(depName);
        if (!depKey) continue;
        block[depName] = `^${plan.packages[depKey]!.effectiveVersion}`;
        touched = true;
      }
    }
    if (touched) writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
  console.error("Rewrote internal deps to caret ranges (working tree).");
}

function printSummary(plan: ReleasePlan): void {
  const pub = plan.publish.length
    ? plan.publish
        .map((k) => `${plan.packages[k]!.name}@${plan.packages[k]!.newVersion}`)
        .join(", ")
    : "(nothing — no package source changed since last release)";
  console.error(`Release plan [bump=${plan.bump}, dist-tag=${plan.distTag}]`);
  console.error(`  publish: ${pub}`);
  console.error(
    `  core (tangly) published: ${plan.corePublished}${plan.tag ? ` -> ${plan.tag}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadPlanFile(): ReleasePlan {
  const file = arg("plan");
  if (!file) {
    console.error("missing --plan <file>");
    process.exit(2);
  }
  return JSON.parse(readFileSync(file, "utf8")) as ReleasePlan;
}

function main(): void {
  const cmd = process.argv[2];
  if (cmd === "plan") {
    const bump = (arg("bump") ?? "patch") as Bump;
    if (!["patch", "minor", "major", "prerelease"].includes(bump)) {
      console.error(`bad --bump: ${bump}`);
      process.exit(2);
    }
    const prereleaseId = arg("prerelease-id") ?? "rc";
    const plan = computePlan(bump, prereleaseId);
    const json = `${JSON.stringify(plan, null, 2)}\n`;
    const out = arg("out");
    if (out) writeFileSync(out, json);
    else process.stdout.write(json);
    printSummary(plan);
  } else if (cmd === "apply-versions") {
    applyVersions(loadPlanFile());
  } else if (cmd === "apply-rewrite") {
    applyRewrite(loadPlanFile());
  } else {
    console.error("usage: release-plan.ts <plan|apply-versions|apply-rewrite> [opts]");
    process.exit(2);
  }
}

// Only run the CLI when executed directly (not when imported by tests).
if (import.meta.main) main();
