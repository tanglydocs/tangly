import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";
import { VERSION } from "../index.js";

/**
 * One-line provenance footer for error output: which tangly produced this
 * message, plus a nudge for the most common false alarm. When a global
 * install (`npm i -g tangly`) is older than a freshly-updated local one,
 * `npm list tangly` reports the new local version while the typed `tangly`
 * command still resolves the stale global on PATH. The result is "same error
 * after upgrading" reports. Stamping the running version under every config
 * error makes that self-diagnosing. Skip it for machine output (`--json`).
 */
export function errorFooter(): void {
  console.error(
    pc.dim(
      `\n  tangly v${VERSION} · if you upgraded but still see old errors, a global ` +
        "install may be shadowing your local copy. Check: `tangly --version`",
    ),
  );
}

const CACHE_FILE = join(tmpdir(), "tangly-update-check.json");
const TTL_MS = 1000 * 60 * 60 * 12; // hit the registry at most once per 12h
const REGISTRY_URL = "https://registry.npmjs.org/tangly/latest";
const FETCH_TIMEOUT_MS = 1500;

interface UpdateCache {
  checkedAt: number;
  latest: string;
}

function readCache(): UpdateCache | null {
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as UpdateCache;
    return typeof c.latest === "string" && typeof c.checkedAt === "number" ? c : null;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // best-effort: a read-only temp dir just means we re-check next run
  }
}

/** True if release `a` is strictly newer than `b` (major.minor.patch; prerelease ignored). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split("-")[0]!.split(".").map(Number);
  const pb = b.split("-")[0]!.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x > y;
  }
  return false;
}

async function fetchLatest(): Promise<string | null> {
  const ctrl = new AbortController();
  // Keep the signal live across BOTH the headers and the body read so a
  // registry that stalls mid-body still aborts at the timeout. unref() so a
  // pending timer can never keep the process alive; clear it in finally so a
  // fetch rejection doesn't leak it.
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  timer.unref?.();
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when env var `name` is present and not an explicit off value (`""`/`0`/`false`). */
function envOptOut(name: string): boolean {
  const v = process.env[name];
  if (v == null || v === "") return false;
  return v !== "0" && v.toLowerCase() !== "false";
}

function suppressed(): boolean {
  return (
    !process.stdout.isTTY ||
    envOptOut("CI") ||
    envOptOut("TANGLY_NO_UPDATE_CHECK") ||
    envOptOut("NO_UPDATE_NOTIFIER")
  );
}

/**
 * Print an "update available" notice when a newer `tangly` is published.
 * Fail-silent and bounded:
 *   - never runs for non-interactive output, CI, or when opted out
 *   - hits the registry at most once per 12h (cached in the OS temp dir)
 *   - aborts the fetch after 1.5s; any error prints nothing
 * The fetch only blocks when the cache is missing or stale, so the common
 * case is a synchronous cache read with zero network latency. The notice
 * goes to stderr so it never corrupts piped stdout.
 */
export async function notifyUpdate(): Promise<void> {
  if (suppressed()) return;
  let cache = readCache();
  if (!cache || Date.now() - cache.checkedAt > TTL_MS) {
    const latest = await fetchLatest();
    if (latest) {
      cache = { checkedAt: Date.now(), latest };
      writeCache(cache);
    }
  }
  if (cache && isNewer(cache.latest, VERSION)) {
    console.error(
      pc.yellow(`\n  ⚠ Update available: tangly ${pc.dim(VERSION)} → ${pc.bold(cache.latest)}`),
    );
    console.error(
      pc.dim("    Upgrade: `npm i -g tangly@latest` (or run `npx tangly` for the local copy)\n"),
    );
  }
}
