import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Manifest, PageEntry } from "../manifest/types.js";
import { describeBuildError } from "./build-error.js";

const TMP = "/tmp/tangly-build-error-test";

function fakeManifest(files: Record<string, string>): Manifest {
  const pages = new Map<string, PageEntry>();
  for (const [slug, content] of Object.entries(files)) {
    const file = join(TMP, `${slug}.mdx`);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
    pages.set(slug, {
      slug,
      file,
      frontmatter: { title: slug },
      breadcrumbs: [],
      sidebar: [],
      draft: false,
    });
  }
  return {
    config: { name: "Test", navigation: {} },
    pages,
    navigation: { tabs: [], anchors: [], rootSidebar: [] },
    orphans: [],
    warnings: [],
    root: TMP,
  };
}

describe("describeBuildError", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  test("re-runs the MDX scan and reports exact source positions", () => {
    const m = fakeManifest({
      "rules/schema/website-search":
        "---\ntitle: X\n---\n\nThe {search_term_string} placeholder.\n",
    });
    const err = new ReferenceError("search_term_string is not defined");
    const lines = describeBuildError(err, m);
    expect(lines[0]).toContain("rules/schema/website-search.mdx:5:6");
    expect(lines[0]).toContain("search_term_string");
    expect(lines.join("\n")).toContain("tangly check");
  });

  test("maps a prerender chunk filename back to the source page", () => {
    const m = fakeManifest({
      "cli/audit": "---\ntitle: X\n---\n\nClean page.\n",
    });
    // Render-time failure the MDX scan can't reproduce (e.g. component throw).
    const err = new Error("boom at render");
    err.stack = `Error: boom at render\n    at /tmp/.tangly-build-x/dist/.prerender/chunks/audit_C0d3xY.mjs:31:9`;
    const lines = describeBuildError(err, m);
    expect(lines[0]).toContain("cli/audit.mdx");
    expect(lines[0]).toContain("boom at render");
  });

  test("adds the backticks hint for ReferenceErrors", () => {
    const m = fakeManifest({ clean: "---\ntitle: X\n---\n\nClean.\n" });
    const err = new ReferenceError("whatever is not defined");
    const lines = describeBuildError(err, m);
    expect(lines.join("\n")).toContain("wrap literal placeholders in backticks");
  });

  test("falls back to the error's first line", () => {
    const m = fakeManifest({ clean: "---\ntitle: X\n---\n\nClean.\n" });
    const lines = describeBuildError(new Error("ENOENT: no such file\nlong stack"), m);
    expect(lines[0]).toContain("Build failed");
    expect(lines[0]).toContain("ENOENT: no such file");
    expect(lines[0]).not.toContain("long stack");
  });
});
