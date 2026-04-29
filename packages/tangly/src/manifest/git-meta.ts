import { execFileSync } from "node:child_process";

interface GitMetaOptions {
  /** Absolute project root. */
  root: string;
}

interface GitMeta {
  /** ISO timestamp of last commit touching the file. */
  lastUpdated: string | undefined;
}

/**
 * Build a per-file git-meta map by running `git log` ONCE for the whole
 * repo. Avoids the N-spawn cost of one log call per file.
 *
 * Returns an empty map for non-git directories or if git fails.
 */
export function loadGitMeta(opts: GitMetaOptions): {
  meta: Map<string, GitMeta>;
  /** Absolute path of the repo root (where `.git` lives). */
  repoRoot: string | undefined;
} {
  const meta = new Map<string, GitMeta>();
  let repoRoot: string | undefined;
  try {
    repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: opts.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return { meta, repoRoot: undefined };
  }
  try {
    // `--name-only --pretty=format:__DATE__:%aI` produces:
    //   __DATE__:2026-04-29T10:00:00+00:00
    //   path/a.mdx
    //   path/b.mdx
    //
    //   __DATE__:2026-04-28T...
    //   path/a.mdx
    // Paths are relative to repoRoot.
    const stdout = execFileSync(
      "git",
      ["log", "--name-only", "--pretty=format:__DATE__:%aI", "--diff-filter=AM"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    let currentDate: string | undefined;
    for (const line of stdout.split("\n")) {
      if (line.startsWith("__DATE__:")) {
        currentDate = line.slice("__DATE__:".length);
        continue;
      }
      if (!line || !currentDate) continue;
      // Newest commit wins; first encounter is the most recent.
      if (!meta.has(line)) meta.set(line, { lastUpdated: currentDate });
    }
  } catch {
    /* swallow */
  }
  return { meta, repoRoot };
}

/**
 * Resolve an edit-on-source URL for a given file path relative to the
 * project root.
 *
 * Resolution order:
 * 1. Explicit `editUrl` template (with `{path}` substitution).
 * 2. `repo` URL — converted to GitHub edit URL with default branch.
 * 3. `git remote get-url origin` — same conversion.
 *
 * Returns null if no source can be resolved.
 */
export function resolveEditUrl(opts: {
  root: string;
  pagePathRelative: string;
  editUrlTemplate?: string;
  repo?: string;
  branch?: string;
}): string | null {
  const { pagePathRelative, editUrlTemplate, repo, root } = opts;
  const branch = opts.branch ?? "main";

  if (editUrlTemplate) {
    return editUrlTemplate.replace("{path}", pagePathRelative);
  }

  const repoUrl =
    repo ??
    (() => {
      try {
        return execFileSync("git", ["remote", "get-url", "origin"], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return undefined;
      }
    })();

  if (!repoUrl) return null;

  const ghMatch =
    repoUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/) ??
    repoUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (ghMatch) {
    const [, owner, repoName] = ghMatch;
    return `https://github.com/${owner}/${repoName}/edit/${branch}/${pagePathRelative}`;
  }

  const glMatch =
    repoUrl.match(/^git@gitlab\.com:([^/]+)\/([^/.]+)(?:\.git)?$/) ??
    repoUrl.match(/^https?:\/\/gitlab\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (glMatch) {
    const [, owner, repoName] = glMatch;
    return `https://gitlab.com/${owner}/${repoName}/-/edit/${branch}/${pagePathRelative}`;
  }

  return null;
}

/**
 * Reading time = wordCount / 200 wpm. Strips frontmatter, code fences,
 * inline code, and HTML before counting.
 */
export function computeReadingTime(markdown: string): number {
  const stripped = markdown
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]+>/g, "");
  const words = stripped.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
