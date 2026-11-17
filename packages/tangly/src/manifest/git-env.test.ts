import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanGitEnv, GIT_REPO_ENV_VARS } from "./git-env.js";
import { loadGitMeta } from "./git-meta.js";
import { isShallowRepository } from "./lastmod.js";

const ID = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"];

describe("inherited GIT_* env (git hooks export GIT_DIR)", () => {
  const dirs: string[] = [];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of GIT_REPO_ENV_VARS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of GIT_REPO_ENV_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const git = (cwd: string, ...args: string[]): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", env: cleanGitEnv() }).trim();

  function repo(file: string): string {
    const dir = mkdtempSync(join(tmpdir(), "tangly-gitenv-"));
    dirs.push(dir);
    git(dir, "init", "-q");
    writeFileSync(join(dir, file), "x\n");
    git(dir, "add", ".");
    git(dir, ...ID, "commit", "-q", "-m", "init");
    return dir;
  }

  test("cleanGitEnv drops every repo-location var and keeps extras", () => {
    for (const k of GIT_REPO_ENV_VARS) process.env[k] = "/nope";
    const env = cleanGitEnv({ GIT_AUTHOR_NAME: "T" });
    for (const k of GIT_REPO_ENV_VARS) expect(env[k]).toBeUndefined();
    expect(env.GIT_AUTHOR_NAME).toBe("T");
  });

  test("a sentinel GIT_DIR gains no commits and does not mislead production lookups", () => {
    const sentinel = repo("sentinel.mdx");
    const target = repo("target.mdx");
    const before = git(sentinel, "rev-list", "--all", "--count");

    process.env.GIT_DIR = join(sentinel, ".git");
    process.env.GIT_WORK_TREE = sentinel;
    process.env.GIT_INDEX_FILE = join(sentinel, ".git", "index");

    // test helper path: commit into the temp repo while GIT_DIR points elsewhere
    writeFileSync(join(target, "more.mdx"), "y\n");
    git(target, "add", ".");
    git(target, ...ID, "commit", "-q", "-m", "two");

    // production path: reads the temp repo, not the sentinel
    const { meta, repoRoot } = loadGitMeta({ root: target });
    expect([...meta.keys()].sort()).toEqual(["more.mdx", "target.mdx"]);
    expect(repoRoot).toBeDefined();
    expect(isShallowRepository(target)).toBe(false);

    delete process.env.GIT_DIR;
    delete process.env.GIT_WORK_TREE;
    delete process.env.GIT_INDEX_FILE;
    expect(git(sentinel, "rev-list", "--all", "--count")).toBe(before);
    expect(git(target, "rev-list", "--all", "--count")).toBe("2");
  });
});
