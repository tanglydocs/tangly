import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { isShallowRepository, resolveLastmod, toW3cDate } from "./lastmod.js";
import { buildManifest } from "./build-manifest.js";

describe("toW3cDate", () => {
  test("accepts dates, datetimes and YAML Date objects", () => {
    expect(toW3cDate("2026-01-02")).toBe("2026-01-02");
    expect(toW3cDate("2026-01-02T10:00:00+02:00")).toBe("2026-01-02");
    expect(toW3cDate(new Date("2026-03-04T00:00:00Z"))).toBe("2026-03-04");
  });
  test("rejects invalid values", () => {
    for (const v of [
      "soon",
      "2026-02-31",
      "2026-13-01",
      "2026-01-02Tgarbage",
      20260102,
      null,
      {},
    ]) {
      expect(toW3cDate(v)).toBeUndefined();
    }
    expect(toW3cDate(new Date("nope"))).toBeUndefined();
  });
});

describe("resolveLastmod", () => {
  test("frontmatter order: lastmod, updated, modified", () => {
    const fm = { lastmod: "2026-01-01", updated: "2026-02-02", modified: "2026-03-03" };
    expect(resolveLastmod(fm, "2026-09-09T00:00:00Z").lastmod).toBe("2026-01-01");
    expect(resolveLastmod({ updated: "2026-02-02", modified: "2026-03-03" }).lastmod).toBe(
      "2026-02-02",
    );
    expect(resolveLastmod({ modified: "2026-03-03" }).lastmod).toBe("2026-03-03");
  });
  test("invalid frontmatter falls through and is reported", () => {
    const r = resolveLastmod({ lastmod: "soon", updated: "2026-02-02" }, "2026-09-09T00:00:00Z");
    expect(r.lastmod).toBe("2026-02-02");
    expect(r.invalid).toEqual([{ key: "lastmod", value: "soon" }]);
    expect(resolveLastmod({ lastmod: "soon" }, "2026-09-09T01:00:00+00:00").lastmod).toBe(
      "2026-09-09",
    );
  });
  test("git date used when no frontmatter; omitted when neither", () => {
    expect(resolveLastmod({}, "2026-09-09T01:00:00+00:00").lastmod).toBe("2026-09-09");
    expect(resolveLastmod({}).lastmod).toBeUndefined();
  });
});

describe("manifest lastmod (real git)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, {
      cwd,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2025-05-06T12:00:00Z",
        GIT_COMMITTER_DATE: "2025-05-06T12:00:00Z",
      },
    });

  function project(withGit: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), "tangly-lastmod-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "docs.json"),
      JSON.stringify({ name: "T", navigation: { pages: ["a", "b", "c"] } }),
    );
    writeFileSync(join(dir, "a.mdx"), "---\ntitle: A\nlastmod: 2024-01-02\n---\nbody\n");
    writeFileSync(join(dir, "b.mdx"), "---\ntitle: B\n---\nbody\n");
    writeFileSync(join(dir, "c.mdx"), '---\ntitle: C\nlastmod: "not a date"\n---\nbody\n');
    if (withGit) {
      git(dir, "init", "-q");
      git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "add", ".");
      git(dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x");
    }
    return dir;
  }

  test("frontmatter, git, and invalid-date warning", async () => {
    const dir = project(true);
    const m = await buildManifest({ root: dir });
    expect(m.pages.get("a")?.lastmod).toBe("2024-01-02");
    expect(m.pages.get("b")?.lastmod).toBe("2025-05-06");
    expect(m.pages.get("c")?.lastmod).toBe("2025-05-06");
    expect(m.gitShallow).toBeUndefined();
    expect(m.warnings.some((w) => w.source === "c.mdx" && /lastmod/.test(w.message))).toBe(true);
  });

  test("not a git repo: omit git dates, keep frontmatter", async () => {
    const dir = project(false);
    expect(isShallowRepository(dir)).toBe(false);
    const m = await buildManifest({ root: dir });
    expect(m.pages.get("a")?.lastmod).toBe("2024-01-02");
    expect(m.pages.get("b")?.lastmod).toBeUndefined();
  });

  test("shallow clone: no git dates, flagged", async () => {
    const src = project(true);
    const dir = mkdtempSync(join(tmpdir(), "tangly-lastmod-shallow-"));
    dirs.push(dir);
    rmSync(dir, { recursive: true });
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${src}`, dir], { stdio: "ignore" });
    expect(isShallowRepository(dir)).toBe(true);
    const m = await buildManifest({ root: dir });
    expect(m.gitShallow).toBe(true);
    expect(m.pages.get("a")?.lastmod).toBe("2024-01-02");
    expect(m.pages.get("b")?.lastmod).toBeUndefined();
  });
});
