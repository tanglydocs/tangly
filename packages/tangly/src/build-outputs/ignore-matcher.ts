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
  // VCS + dependency manager state. No trailing slash: in a submodule
  // checkout `.git` is a gitlink FILE (whose content leaks an absolute
  // filesystem path) — the pattern must match both file and directory.
  ".git",
  "node_modules/",
  // Lockfiles + manifests + ts/build config — not for shipping.
  "bun.lock",
  "bun.lockb",
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
  // Ignore control files — meta/internal, may leak directory + secret filenames.
  ".gitignore",
  ".tanglyignore",
  // Convention.
  "README.md",
];

/**
 * Default ignore — applied before the user's own rules, so a `!pattern`
 * in `.tanglyignore` (or `.gitignore`) CAN re-include any of these.
 *
 * Repo plumbing that routinely sits at a docs root and has no business in
 * a published site, but where a deliberate opt-back-in is legitimate
 * (`.htaccess` on Apache hosts, for example).
 */
const DEFAULTS = [
  // Dotfiles generally — CI config, editor state, VCS metadata.
  ".*",
  // …except the ones static hosts actually serve.
  "!.well-known",
  "!.well-known/**",
  "!.nojekyll",
  // Build + deploy tooling config.
  "Makefile",
  "makefile",
  "wrangler.*",
  "vercel.json",
  "netlify.toml",
  // Backup cruft — `tangly migrate` itself writes mint.json.bak.
  "*.bak",
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
 * Build the ignore stack for the user's project.
 *
 * Two layers, evaluated independently so baseline cannot be undone:
 *
 *   1. **Baseline** — its own `Ignore` instance. If it rejects a path,
 *      we short-circuit before user rules ever see it. This makes
 *      baseline TRULY non-overridable: a user `!.gitignore` pattern
 *      can't re-include the gitignore control file, and a user
 *      `!node_modules/foo` can't undo the build-noise exclusion.
 *
 *   2. **User layer** — DEFAULTS + `.gitignore` (root) + `.tanglyignore`
 *      (root) merged into a second `Ignore` instance, in that order.
 *      Last-match-wins within the instance, so a `!path` pattern in
 *      `.tanglyignore` CAN re-include something `.gitignore` or the
 *      DEFAULTS excluded (intentional escape hatch for "in git but
 *      also in build" cases, or shipping a dotfile like `.htaccess`).
 *
 * Cascading sub-directory `.gitignore` files are not honored — only
 * root-level. Documented limitation.
 */
export function buildIgnoreMatcher(opts: BuildIgnoreMatcherOptions): IgnoreMatcher {
  const sources: string[] = ["baseline"];
  const baseline: Ignore = ignore().add(BASELINE);
  const userLayer: Ignore = ignore().add(DEFAULTS);

  const gitignore = join(opts.userRoot, ".gitignore");
  if (existsSync(gitignore)) {
    userLayer.add(readFileSync(gitignore, "utf8"));
    sources.push(".gitignore");
  }

  const tanglyignore = join(opts.userRoot, ".tanglyignore");
  if (existsSync(tanglyignore)) {
    userLayer.add(readFileSync(tanglyignore, "utf8"));
    sources.push(".tanglyignore");
  }

  function isIgnored(relativePath: string): boolean {
    const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!normalized) return true;
    // Baseline is the floor — short-circuit so user rules can't unmask it.
    if (baseline.ignores(normalized)) return true;
    if (userLayer.ignores(normalized)) return true;
    return false;
  }

  return {
    shouldCopy(relativePath: string): boolean {
      return !isIgnored(relativePath);
    },
    ignores(relativePath: string): boolean {
      return isIgnored(relativePath);
    },
    sources,
  };
}
