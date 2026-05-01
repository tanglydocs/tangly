import { describe, expect, test } from "vitest";
import { generateLlmsTxt, generateRobots, generateSitemap } from "./index.js";
import type { Manifest, PageEntry } from "../manifest/types.js";

function fakeManifest(): Manifest {
  const pages = new Map<string, PageEntry>();
  pages.set("introduction", {
    slug: "introduction",
    file: "/x/introduction.mdx",
    frontmatter: { title: "Introduction", description: "Welcome" },
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
  pages.set("draft", {
    slug: "draft",
    file: "/x/draft.mdx",
    frontmatter: { title: "Draft" },
    breadcrumbs: [],
    sidebar: [],
    draft: true,
  });
  return {
    config: {
      name: "Test Docs",
      description: "Test description",
      navigation: {},
    },
    pages,
    navigation: { tabs: [], anchors: [], rootSidebar: [] },
    orphans: [],
    warnings: [],
    root: "/x",
  };
}

describe("build-outputs", () => {
  const manifest = fakeManifest();

  test("sitemap excludes drafts and noindex", () => {
    const xml = generateSitemap({ manifest, outDir: "/tmp" });
    expect(xml).toContain("/introduction");
    expect(xml).not.toContain("/hidden");
    expect(xml).not.toContain("/draft");
  });

  test("sitemap uses absolute URL when siteUrl set", () => {
    const xml = generateSitemap({
      manifest,
      outDir: "/tmp",
      siteUrl: "https://example.com",
    });
    expect(xml).toContain("https://example.com/introduction");
  });

  test("robots references sitemap", () => {
    const txt = generateRobots({
      manifest,
      outDir: "/tmp",
      siteUrl: "https://example.com",
    });
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  test("llms.txt lists pages with descriptions", () => {
    const txt = generateLlmsTxt({ manifest, outDir: "/tmp" });
    expect(txt).toContain("# Test Docs");
    expect(txt).toContain("- [Introduction](/introduction): Welcome");
    expect(txt).not.toContain("Hidden");
    expect(txt).not.toContain("Draft");
  });

  test("base prefix prepended to sitemap, robots, llms.txt", () => {
    const xml = generateSitemap({ manifest, outDir: "/tmp", base: "/docs" });
    expect(xml).toContain("<loc>/docs/introduction</loc>");
    expect(xml).not.toMatch(/<loc>\/introduction</);

    const xmlAbs = generateSitemap({
      manifest,
      outDir: "/tmp",
      base: "/docs",
      siteUrl: "https://example.com",
    });
    expect(xmlAbs).toContain("https://example.com/docs/introduction");

    const robots = generateRobots({
      manifest,
      outDir: "/tmp",
      base: "/docs/",
      siteUrl: "https://example.com",
    });
    expect(robots).toContain("Sitemap: https://example.com/docs/sitemap.xml");

    const llms = generateLlmsTxt({ manifest, outDir: "/tmp", base: "/docs" });
    expect(llms).toContain("- [Introduction](/docs/introduction): Welcome");
  });

  test("base of '/' or empty is treated as root", () => {
    const root = generateLlmsTxt({ manifest, outDir: "/tmp", base: "/" });
    expect(root).toContain("- [Introduction](/introduction): Welcome");
    const empty = generateLlmsTxt({ manifest, outDir: "/tmp", base: "" });
    expect(empty).toContain("- [Introduction](/introduction): Welcome");
  });
});
