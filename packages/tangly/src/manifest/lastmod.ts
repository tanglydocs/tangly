import { execFileSync } from "node:child_process";

/** Frontmatter keys read for a sitemap `<lastmod>`, in priority order. */
export const LASTMOD_KEYS = ["lastmod", "updated", "modified"] as const;

/**
 * Normalize a frontmatter date to a W3C date (`YYYY-MM-DD`), or undefined when
 * it is not a real calendar date. YAML parses an unquoted `2026-01-02` into a
 * `Date`; quoted values arrive as strings (`2026-01-02` or a full ISO
 * datetime). Impossible dates such as `2026-02-31` are rejected rather than
 * rolled over.
 */
export function toW3cDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(value.trim());
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const probe = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (
    probe.getUTCFullYear() !== Number(y) ||
    probe.getUTCMonth() !== Number(mo) - 1 ||
    probe.getUTCDate() !== Number(d)
  ) {
    return undefined;
  }
  // A full datetime must also parse as one (catches "2026-01-02Tgarbage").
  if (value.trim().length > 10 && Number.isNaN(Date.parse(value.trim().replace(" ", "T")))) {
    return undefined;
  }
  return `${y}-${mo}-${d}`;
}

export interface LastmodResult {
  /** `YYYY-MM-DD`, or undefined to omit `<lastmod>` for the page. */
  lastmod?: string;
  /** Frontmatter keys that were present but not a valid date. */
  invalid: Array<{ key: string; value: string }>;
}

/**
 * Pick a page's `<lastmod>`: frontmatter `lastmod`, then `updated`, then
 * `modified` (invalid values fall through to the next), then the git commit
 * date when supplied. Never fabricates a date.
 */
export function resolveLastmod(
  frontmatter: Record<string, unknown>,
  gitDate?: string,
): LastmodResult {
  const invalid: LastmodResult["invalid"] = [];
  for (const key of LASTMOD_KEYS) {
    const raw = frontmatter[key];
    if (raw === undefined || raw === null) continue;
    const date = toW3cDate(raw);
    if (date) return { lastmod: date, invalid };
    invalid.push({ key, value: raw instanceof Date ? "Invalid Date" : String(raw) });
  }
  const fromGit = gitDate ? toW3cDate(gitDate) : undefined;
  return { ...(fromGit ? { lastmod: fromGit } : {}), invalid };
}

/**
 * True when `root` sits in a shallow git clone (CI default `fetch-depth: 1`),
 * where every file reports the same commit date. False for a full clone, a
 * non-repo directory, or when git is missing.
 */
export function isShallowRepository(root: string): boolean {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}
