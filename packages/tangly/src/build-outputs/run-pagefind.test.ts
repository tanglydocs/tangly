import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Manifest, PageEntry } from "../manifest/types.js";
import { runPagefind } from "./run-pagefind.js";

const TMP = "/tmp/tangly-pagefind-test";

function fakeManifest(): Manifest {
  const pages = new Map<string, PageEntry>();
  pages.set("intro", {
    slug: "intro",
    file: "/x/intro.mdx",
    frontmatter: { title: "Intro" },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("hidden", {
    slug: "hidden",
    file: "/x/hidden.mdx",
    frontmatter: { title: "Hidden", noindex: true },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("draft-page", {
    slug: "draft-page",
    file: "/x/draft.mdx",
    frontmatter: { title: "Draft" },
    breadcrumbs: [],
    sidebar: [],
    draft: true,
  });
  return {
    config: { name: "Test", navigation: {} },
    pages,
    navigation: { tabs: [], anchors: [], rootSidebar: [] },
    orphans: [],
    warnings: [],
    root: TMP,
  };
}

function writeHtml(slug: string, body: string): void {
  const dir = join(TMP, "out", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><html><body><main data-pagefind-body data-pagefind-meta="title:${slug}"><span data-pagefind-meta="slug:${slug}" hidden></span>${body}</main></body></html>`,
  );
}

describe("runPagefind", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "out"), { recursive: true });
    writeHtml("intro", "<h1>Welcome</h1><p>Hello world from intro.</p>");
    writeHtml("hidden", "<h1>Hidden page</h1><p>This page should be excluded.</p>");
    writeHtml("draft-page", "<h1>Draft</h1><p>This page is a draft.</p>");
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  test("emits pagefind index, excluding drafts and noindex", async () => {
    const m = fakeManifest();
    const result = await runPagefind({ manifest: m, outDir: join(TMP, "out") });

    // Excluded slugs include noindex (hidden) + draft (draft-page).
    expect(result.excluded.sort()).toEqual(["draft-page", "hidden"]);

    // Pagefind output landed.
    expect(existsSync(join(TMP, "out/pagefind/pagefind.js"))).toBe(true);

    // The excluded HTML files were removed before indexing.
    expect(existsSync(join(TMP, "out/hidden/index.html"))).toBe(false);
    expect(existsSync(join(TMP, "out/draft-page/index.html"))).toBe(false);
    expect(existsSync(join(TMP, "out/intro/index.html"))).toBe(true);
  });
});
