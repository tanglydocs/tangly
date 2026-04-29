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
    file: join(TMP, "src/intro.mdx"),
    frontmatter: { title: "Intro" },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("hidden", {
    slug: "hidden",
    file: join(TMP, "src/hidden.mdx"),
    frontmatter: { title: "Hidden", noindex: true },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("draft-page", {
    slug: "draft-page",
    file: join(TMP, "src/draft-page.mdx"),
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
    root: join(TMP, "src"),
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

function writeMdx(slug: string, frontmatter: Record<string, unknown>): void {
  const dir = join(TMP, "src");
  mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
  writeFileSync(
    join(dir, `${slug}.mdx`),
    `---\n${fm}\n---\n\n# ${slug}\n`,
  );
}

describe("runPagefind", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "out"), { recursive: true });
    mkdirSync(join(TMP, "src"), { recursive: true });

    writeHtml("intro", "<h1>Welcome</h1><p>Hello world from intro.</p>");
    writeHtml("hidden", "<h1>Hidden page</h1><p>Should not be indexed.</p>");
    writeHtml("draft-page", "<h1>Draft</h1><p>Draft content.</p>");
    writeHtml("orphan", "<h1>Orphan</h1><p>Orphan with noindex.</p>");

    writeMdx("intro", { title: "Intro" });
    writeMdx("hidden", { title: "Hidden", noindex: true });
    writeMdx("draft-page", { title: "Draft", draft: true });
    writeMdx("orphan", { title: "Orphan", noindex: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  test("indexes only allowed pages, leaves all HTML on disk", async () => {
    const m = fakeManifest();
    const result = await runPagefind({
      manifest: m,
      outDir: join(TMP, "out"),
    });

    // intro is the only allowed page; orphan is on disk only and noindex.
    expect(result.indexed).toBe(1);
    expect(new Set(result.excluded)).toEqual(
      new Set(["hidden", "draft-page", "orphan"]),
    );

    // CRITICAL: noindex/draft HTML stays on disk so deep links still work.
    expect(existsSync(join(TMP, "out/intro/index.html"))).toBe(true);
    expect(existsSync(join(TMP, "out/hidden/index.html"))).toBe(true);
    expect(existsSync(join(TMP, "out/draft-page/index.html"))).toBe(true);
    expect(existsSync(join(TMP, "out/orphan/index.html"))).toBe(true);

    // Pagefind output landed.
    expect(existsSync(join(TMP, "out/pagefind/pagefind.js"))).toBe(true);
  });
});
