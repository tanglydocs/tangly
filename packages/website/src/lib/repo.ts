/**
 * Build-time repo metadata: the published `tangly` version (from the workspace
 * package.json, always available offline) plus a GitHub snapshot (stars + latest
 * release date) baked into the HTML. The browser refreshes stars live and
 * recomputes the relative release time, so the bake is just the no-JS fallback.
 *
 * Server-only: imports node:fs. Do not import from a client `<script>`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REPO = "tanglydocs/tangly";
export const GITHUB_URL = `https://github.com/${REPO}`;
export const GITHUB_API = `https://api.github.com/repos/${REPO}`;
export const CHANGELOG_URL = "https://docs.tangly.dev/changelog";

/** Fallback version if the workspace package.json can't be read at build. */
const FALLBACK_VERSION = "0.1.4";

export interface RepoMeta {
  /** Published CLI version, e.g. "0.1.4". */
  version: string;
  /** Stargazers at build time, or null if GitHub was unreachable. */
  stars: number | null;
  /** ISO timestamp of the latest release, or null if unavailable. */
  releasedAt: string | null;
}

function readVersion(): string {
  // astro dev/build run with cwd = packages/website; the repo-root fallback
  // covers invocations from the monorepo root.
  const candidates = [
    resolve(process.cwd(), "../tangly/package.json"),
    resolve(process.cwd(), "packages/tangly/package.json"),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // try next candidate
    }
  }
  return FALLBACK_VERSION;
}

let cache: Promise<RepoMeta> | undefined;

/** Memoized per build process, so nav + footer share a single GitHub fetch. */
export function getRepoMeta(): Promise<RepoMeta> {
  cache ??= load();
  return cache;
}

async function load(): Promise<RepoMeta> {
  const version = readVersion();
  let stars: number | null = null;
  let releasedAt: string | null = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tangly-website",
  };

  // allSettled (not all): a 404 on /releases/latest (repo with no releases) or a
  // single rejected fetch must not discard the other endpoint's data.
  const [repoRes, relRes] = await Promise.allSettled([
    fetch(GITHUB_API, { headers, signal: controller.signal }),
    fetch(`${GITHUB_API}/releases/latest`, { headers, signal: controller.signal }),
  ]);
  clearTimeout(timer);

  if (repoRes.status === "fulfilled" && repoRes.value.ok) {
    try {
      const data = (await repoRes.value.json()) as { stargazers_count?: number };
      if (typeof data.stargazers_count === "number") stars = data.stargazers_count;
    } catch {
      // malformed body: leave stars null
    }
  }
  if (relRes.status === "fulfilled" && relRes.value.ok) {
    try {
      const data = (await relRes.value.json()) as { published_at?: string };
      if (typeof data.published_at === "string") releasedAt = data.published_at;
    } catch {
      // malformed body: leave releasedAt null
    }
  }

  return { version, stars, releasedAt };
}
