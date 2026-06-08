import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { scanPages } from "./scan-pages.js";

const TMP = "/tmp/tangly-scan-pages-test";

function write(rel: string, body = "---\ntitle: x\n---\nbody\n"): void {
  const path = `${TMP}/${rel}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

describe("scanPages", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  test("excludes project meta files but keeps AGENTS.md, index, and real pages", async () => {
    write("index.mdx");
    write("introduction.mdx");
    write("guides/start.mdx");
    write("README.md");
    write("LICENSE.md");
    write("CHANGELOG.md");
    write("CONTRIBUTING.md");
    write("AGENTS.md", "no frontmatter, plain markdown\n");
    write("_partial.mdx");

    const slugs = (await scanPages(TMP)).map((p) => p.slug);

    expect(slugs).toEqual(
      expect.arrayContaining(["index", "introduction", "guides/start", "AGENTS"]),
    );
    for (const excluded of ["README", "LICENSE", "CHANGELOG", "CONTRIBUTING", "_partial"]) {
      expect(slugs).not.toContain(excluded);
    }
  });

  test("nested index collapses to its directory slug", async () => {
    write("guides/index.mdx");
    const slugs = (await scanPages(TMP)).map((p) => p.slug);
    expect(slugs).toContain("guides");
    expect(slugs).not.toContain("guides/index");
  });

  // Locks the invariant the home-render draft guard relies on: a root index.mdx
  // gets slug "index" with its draft flag preserved, so a draft home lands in
  // excludedSlugs and the / route falls back to the splash in production.
  test("root index.mdx yields slug 'index' and preserves draft", async () => {
    write("index.mdx", "---\ntitle: Home\ndraft: true\n---\nbody\n");
    const home = (await scanPages(TMP)).find((p) => p.slug === "index");
    expect(home).toBeDefined();
    expect(home?.frontmatter?.draft).toBe(true);
  });
});
