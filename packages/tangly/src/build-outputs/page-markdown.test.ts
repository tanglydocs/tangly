import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { writePageMarkdown } from "./page-markdown.js";
import type { Manifest, PageEntry } from "../manifest/types.js";

describe("writePageMarkdown base-path link rewriting", () => {
  // Regression: the `<slug>.md` twin tangly emits for AI agents pushed the
  // raw MDX body straight through without applying --base to internal
  // links, even though the `URL:` preamble above it (and the rendered HTML)
  // already did. See rewrite-body-links.test.ts for the rewrite rules.
  let srcDir: string;
  let outDir: string;

  afterEach(() => {
    rmSync(srcDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  function setup(body: string): Manifest {
    srcDir = mkdtempSync(join(tmpdir(), "tangly-pagemd-src-"));
    outDir = mkdtempSync(join(tmpdir(), "tangly-pagemd-out-"));
    const file = join(srcDir, "introduction.mdx");
    writeFileSync(file, `---\ntitle: Introduction\n---\n${body}`, "utf8");
    const pages = new Map<string, PageEntry>();
    pages.set("introduction", {
      slug: "introduction",
      file,
      frontmatter: { title: "Introduction" },
      breadcrumbs: [],
      sidebar: [],
      draft: false,
    });
    pages.set("reference/components", {
      slug: "reference/components",
      file: join(srcDir, "reference-components.mdx"),
      frontmatter: { title: "Components" },
      breadcrumbs: [],
      sidebar: [],
      draft: false,
    });
    return {
      config: { name: "Test Docs", navigation: {} },
      pages,
      navigation: { tabs: [], anchors: [], rootSidebar: [] },
      orphans: [],
      warnings: [],
      root: srcDir,
    };
  }

  test("prefixes internal links in the body, matching the URL: preamble", () => {
    const manifest = setup("See [components](/reference/components) for more.");
    writePageMarkdown({ manifest, outDir, base: "/docs" });
    const written = readFileSync(join(outDir, "introduction.md"), "utf8");
    expect(written).toContain("URL: /docs/introduction");
    expect(written).toContain("[components](/docs/reference/components)");
    expect(written).not.toContain("](/reference/components)");
  });

  test("leaves a non-page path (e.g. a literal API endpoint) alone", () => {
    const manifest = setup("`GET /api/v1/domains` returns a list.");
    writePageMarkdown({ manifest, outDir, base: "/docs" });
    const written = readFileSync(join(outDir, "introduction.md"), "utf8");
    expect(written).toContain("`GET /api/v1/domains`");
  });

  test("no base: body is unchanged", () => {
    const manifest = setup("See [components](/reference/components) for more.");
    writePageMarkdown({ manifest, outDir });
    const written = readFileSync(join(outDir, "introduction.md"), "utf8");
    expect(written).toContain("[components](/reference/components)");
  });
});
