import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Baseline ignore — always applied, never overrideable.
 *
 * Stops users from accidentally publishing build noise, secrets, lockfiles,
 * tangly's own metadata, and source files that are rendered as pages
 * (`*.md`/`*.mdx`) rather than shipped raw.
 */
const BASELINE = [
  // Source files that compile to pages — never ship raw.
  "**/*.md",
  "**/*.mdx",
  // Snippets / partials (excluded from page scan too).
  "**/_*.md",
  "**/_*.mdx",
  // Tangly + Astro internals + common build artifact dirs.
  ".tangly/",
  ".tanglycache/",
  ".astro/",
  ".vercel/",
  ".wrangler/",
  ".next/",
  "dist/",
  // VCS + dependency manager state.
  ".git/",
  "node_modules/",
  // Lockfiles + manifests + ts/build config — not for shipping.
  "bun.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "package.json",
  "tsconfig*.json",
  ".changeset/",
  // Tangly's own config — not for shipping.
  "docs.json",
  "mint.json",
  // Common cruft.
  ".DS_Store",
  "*.log",
  ".env",
  ".env.*",
  "Thumbs.db",
  // Convention.
  "README.md",
];

export interface BuildIgnoreMatcherOptions {
  /** Project root (where docs.json + .gitignore + .tanglyignore live). */
  userRoot: string;
}

export interface IgnoreMatcher {
  /** Returns `true` if the path (POSIX-style, relative to userRoot) should be copied. */
  shouldCopy(relativePath: string): boolean;
  /** Returns `true` if the path should be skipped (inverse of shouldCopy). */
  ignores(relativePath: string): boolean;
  /** Sources that contributed rules — useful for diagnostics. */
  sources: string[];
}

/**
 * Build the additive ignore stack for the user's project.
 *
 * Order: baseline → .gitignore (root) → .tanglyignore (root). Later layers
 * extend earlier ones; nothing in baseline is overrideable. The `ignore`
 * package supports negation patterns (`!path`) so users can re-include
 * baseline-excluded files in `.tanglyignore` if they really need to —
 * but baseline patterns intentionally cover paths that should never ship.
 */
export function buildIgnoreMatcher(opts: BuildIgnoreMatcherOptions): IgnoreMatcher {
  const sources: string[] = ["baseline"];
  const ig: Ignore = ignore().add(BASELINE);

  const gitignore = join(opts.userRoot, ".gitignore");
  if (existsSync(gitignore)) {
    ig.add(readFileSync(gitignore, "utf8"));
    sources.push(".gitignore");
  }

  const tanglyignore = join(opts.userRoot, ".tanglyignore");
  if (existsSync(tanglyignore)) {
    ig.add(readFileSync(tanglyignore, "utf8"));
    sources.push(".tanglyignore");
  }

  return {
    shouldCopy(relativePath: string): boolean {
      // ignore() requires forward slashes + no leading slash.
      const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
      if (!normalized) return false;
      return !ig.ignores(normalized);
    },
    ignores(relativePath: string): boolean {
      const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
      if (!normalized) return true;
      return ig.ignores(normalized);
    },
    sources,
  };
}
