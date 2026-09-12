/**
 * The manifest side of JSON-LD: the nav trail a BreadcrumbList is built from,
 * and the git-derived dates. Both are computed once per build here rather than
 * per page render, so this is where their correctness is pinned.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildManifest, buildNavPath } from "./build-manifest.js";
import { loadGitMeta } from "./git-meta.js";
import { scanPages } from "./scan-pages.js";
import type { SidebarItem } from "./types.js";

const TMP = "/tmp/tangly-jsonld-inputs-test";

function setup(files: Record<string, string>, root = TMP): void {
  rmSync(root, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files)) {
    const path = `${root}/${rel}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

function group(title: string, children: SidebarItem[], slug = ""): SidebarItem {
  return { title, slug, isGroup: true, children };
}

function page(title: string, slug: string): SidebarItem {
  return { title, slug, isGroup: false };
}

describe("buildNavPath", () => {
  const sidebar = [
    group("Authoring", [page("Pages", "guides/authoring/pages")]),
    group("Themes", [group("Built-in", [page("Tang", "guides/themes/tang")])]),
  ];

  test("tab first, then each enclosing group, outermost first", () => {
    expect(
      buildNavPath(sidebar, "guides/themes/tang", { slug: "guides", title: "Guides" }),
    ).toEqual([{ title: "Guides" }, { title: "Themes" }, { title: "Built-in" }]);
  });

  test("excludes the page itself", () => {
    const path = buildNavPath(sidebar, "guides/authoring/pages", undefined);
    expect(path.map((p) => p.title)).toEqual(["Authoring"]);
  });

  test("a grouping header with no page of its own carries no slug", () => {
    const path = buildNavPath(sidebar, "guides/authoring/pages", undefined);
    expect(path[0]).toEqual({ title: "Authoring" });
    expect(path[0]).not.toHaveProperty("slug");
  });

  test("a group that is itself a page carries its slug", () => {
    const withSlug = [group("Themes", [page("Tang", "themes/tang")], "themes")];
    expect(buildNavPath(withSlug, "themes/tang", undefined)).toEqual([
      { title: "Themes", slug: "themes" },
    ]);
  });

  test("a group landing page is not an ancestor of itself", () => {
    const withSlug = [group("Themes", [page("Tang", "themes/tang")], "themes")];
    expect(buildNavPath(withSlug, "themes", undefined)).toEqual([]);
  });

  test("a group whose pages sit under a shared index gets that index as its slug", () => {
    const themed = [
      group("Themes", [
        page("Themes overview", "guides/themes/index"),
        page("Tang", "guides/themes/tang"),
        page("Pith", "guides/themes/pith"),
      ]),
    ];
    expect(buildNavPath(themed, "guides/themes/tang", undefined)).toEqual([
      { title: "Themes", slug: "guides/themes/index" },
    ]);
  });

  test("that index page is not an ancestor of itself", () => {
    const themed = [
      group("Themes", [
        page("Themes overview", "guides/themes/index"),
        page("Tang", "guides/themes/tang"),
      ]),
    ];
    expect(buildNavPath(themed, "guides/themes/index", undefined)).toEqual([]);
    // The collapsed form of the same route resolves identically.
    expect(buildNavPath(themed, "guides/themes", undefined)).toEqual([]);
  });

  test("a flat group with no shared index stays a bare title", () => {
    const flat = [
      group("Authoring", [
        page("Pages", "guides/authoring/pages"),
        page("Navigation", "guides/authoring/navigation"),
      ]),
    ];
    expect(buildNavPath(flat, "guides/authoring/pages", undefined)).toEqual([
      { title: "Authoring" },
    ]);
  });

  test("a page outside the sidebar yields just the tab", () => {
    expect(buildNavPath(sidebar, "nowhere", { slug: "guides", title: "Guides" })).toEqual([
      { title: "Guides" },
    ]);
  });

  test("no tab and no match yields an empty path", () => {
    expect(buildNavPath(sidebar, "nowhere", undefined)).toEqual([]);
  });
});

describe("manifest structured-data fields", () => {
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  const docsJson = JSON.stringify({
    name: "T",
    navigation: {
      tabs: [{ tab: "Guides", groups: [{ group: "Setup", pages: ["intro", "stub"] }] }],
    },
  });

  test("frontmatter dates win over git and land on the page entry", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx":
        '---\ntitle: Intro\ndatePublished: "2020-01-01"\ndateModified: "2021-02-03"\n---\nbody\n',
      "stub.mdx": "---\ntitle: Stub\n---\n",
    });
    const manifest = await buildManifest({ root: TMP });
    const intro = manifest.pages.get("intro")!;
    expect(intro.datePublished).toBe("2020-01-01");
    expect(intro.dateModified).toBe("2021-02-03");
  });

  test("an unquoted YAML date parses and normalizes to ISO 8601", async () => {
    // YAML turns a bare `2020-01-01` into a Date. Before the schema accepted
    // one, this failed the whole page's frontmatter rather than the field.
    setup({
      "docs.json": docsJson,
      "intro.mdx":
        "---\ntitle: Intro\ndatePublished: 2020-01-01\ndateModified: 2021-02-03\n---\nbody\n",
      "stub.mdx": "---\ntitle: Stub\n---\n",
    });
    const manifest = await buildManifest({ root: TMP });
    const intro = manifest.pages.get("intro")!;
    expect(intro.frontmatter.title).toBe("Intro");
    expect(intro.datePublished).toBe("2020-01-01T00:00:00.000Z");
    expect(intro.dateModified).toBe("2021-02-03T00:00:00.000Z");
  });

  test("hasBody is false for a page that is only frontmatter", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
      "stub.mdx": "---\ntitle: Stub\n---\n\n   \n",
    });
    const manifest = await buildManifest({ root: TMP });
    expect(manifest.pages.get("intro")?.hasBody).toBe(true);
    expect(manifest.pages.get("stub")?.hasBody).toBe(false);
  });

  test("navPath records the tab and group trail", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
      "stub.mdx": "---\ntitle: Stub\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    expect(manifest.pages.get("intro")?.navPath).toEqual([{ title: "Guides" }, { title: "Setup" }]);
  });

  test("lastUpdated: false keeps the date out of dateModified too", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx": "---\ntitle: Intro\nlastUpdated: false\n---\nbody\n",
      "stub.mdx": "---\ntitle: Stub\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    const intro = manifest.pages.get("intro")!;
    expect(intro.lastUpdated).toBeUndefined();
    expect(intro.dateModified).toBeUndefined();
  });

  test("an explicit dateModified still wins when the footer stamp is hidden", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx": '---\ntitle: Intro\nlastUpdated: false\ndateModified: "2026-05-05"\n---\nbody\n',
      "stub.mdx": "---\ntitle: Stub\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    expect(manifest.pages.get("intro")?.dateModified).toBe("2026-05-05");
  });

  test("a non-git directory simply has no dates — never a build timestamp", async () => {
    setup({
      "docs.json": docsJson,
      "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
      "stub.mdx": "---\ntitle: Stub\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    const intro = manifest.pages.get("intro")!;
    // /tmp is not a repo, so git yields nothing and both dates are absent.
    expect(intro.datePublished).toBeUndefined();
    expect(intro.dateModified).toBeUndefined();
  });
});

describe("git dates", () => {
  const REPO = "/tmp/tangly-jsonld-git-test";
  afterEach(() => rmSync(REPO, { recursive: true, force: true }));

  const git = (args: string[]): void => {
    execFileSync("git", args, {
      cwd: REPO,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "T",
        GIT_AUTHOR_EMAIL: "t@example.com",
        GIT_COMMITTER_NAME: "T",
        GIT_COMMITTER_EMAIL: "t@example.com",
      },
    });
  };

  test("first and last commit dates come from one log pass", () => {
    setup(
      {
        "docs.json": JSON.stringify({ name: "T", navigation: { pages: ["intro"] } }),
        "intro.mdx": "---\ntitle: Intro\n---\nfirst\n",
      },
      REPO,
    );
    git(["init", "-q"]);
    git(["add", "."]);
    git(["-c", "commit.gpgsign=false", "commit", "-q", "-m", "one", "--date=2020-01-02T03:04:05Z"]);

    writeFileSync(`${REPO}/intro.mdx`, "---\ntitle: Intro\n---\nsecond\n");
    git(["add", "."]);
    git(["-c", "commit.gpgsign=false", "commit", "-q", "-m", "two", "--date=2024-05-06T07:08:09Z"]);

    const { meta } = loadGitMeta({ root: REPO });
    const entry = meta.get("intro.mdx")!;
    expect(entry.created).toContain("2020-01-02");
    expect(entry.lastUpdated).toContain("2024-05-06");
  });

  test("scanPages decorates pages with both dates", async () => {
    setup(
      {
        "docs.json": JSON.stringify({ name: "T", navigation: { pages: ["intro"] } }),
        "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
      },
      REPO,
    );
    git(["init", "-q"]);
    git(["add", "."]);
    git(["-c", "commit.gpgsign=false", "commit", "-q", "-m", "one", "--date=2020-01-02T03:04:05Z"]);

    const pages = await scanPages(REPO);
    const intro = pages.find((p) => p.slug === "intro")!;
    expect(intro.created).toContain("2020-01-02");
    expect(intro.lastUpdated).toContain("2020-01-02");
  });

  test("a directory with no repo yields an empty map, not a throw", () => {
    setup({ "intro.mdx": "x" }, REPO);
    const { meta, repoRoot } = loadGitMeta({ root: REPO });
    expect(repoRoot).toBeUndefined();
    expect(meta.size).toBe(0);
  });
});
