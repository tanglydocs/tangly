import { describe, expect, test } from "vitest";
import { collectPageRoutes, rewriteBodyLinks } from "./rewrite-body-links.js";
import type { Manifest, PageEntry } from "../manifest/types.js";

function fakeManifest(): Manifest {
  const pages = new Map<string, PageEntry>();
  pages.set("introduction", {
    slug: "introduction",
    file: "/x/introduction.mdx",
    frontmatter: { title: "Introduction" },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("index", {
    slug: "index",
    file: "/x/index.mdx",
    frontmatter: { title: "Home" },
    breadcrumbs: [],
    sidebar: [],
    draft: false,
  });
  pages.set("reference/components", {
    slug: "reference/components",
    file: "/x/reference/components.mdx",
    frontmatter: { title: "Components" },
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
    config: { name: "Test Docs", navigation: {} },
    pages,
    navigation: { tabs: [], anchors: [], rootSidebar: [] },
    orphans: [],
    warnings: [],
    root: "/x",
  };
}

describe("collectPageRoutes", () => {
  test("includes served routes, excludes drafts", () => {
    const routes = collectPageRoutes(fakeManifest());
    expect(routes.has("/introduction")).toBe(true);
    expect(routes.has("/")).toBe(true); // root index.mdx
    expect(routes.has("/reference/components")).toBe(true);
    expect(routes.has("/draft")).toBe(false);
  });
});

describe("rewriteBodyLinks", () => {
  const routes = collectPageRoutes(fakeManifest());

  test("prefixes markdown links to known pages", () => {
    const body = "See the [intro](/introduction) and [components](/reference/components).";
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(
      "See the [intro](/docs/introduction) and [components](/docs/reference/components).",
    );
  });

  test("prefixes JSX href attributes to known pages", () => {
    const body = '<Card href="/introduction">Intro</Card>';
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(
      '<Card href="/docs/introduction">Intro</Card>',
    );
  });

  test("prefixes the root route", () => {
    const body = "[Home](/)";
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe("[Home](/docs/)");
  });

  test("prefixes a link to another page's .md twin", () => {
    const body = '<Card href="/reference/components.md">Components</Card>';
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(
      '<Card href="/docs/reference/components.md">Components</Card>',
    );
  });

  test("leaves literal API endpoints alone (not a known page)", () => {
    const body = "`GET /api/v1/domains` returns a list. See [docs](/api/v1/domains).";
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(body);
  });

  test("leaves external URLs, anchors, and protocol-relative targets alone", () => {
    const body =
      "[External](https://example.com/introduction) [Anchor](#section) [Protocol](//cdn.example.com/x)";
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(body);
  });

  test("is idempotent — an already-prefixed link is left alone", () => {
    const once = rewriteBodyLinks("[intro](/introduction)", "/docs", routes);
    expect(rewriteBodyLinks(once, "/docs", routes)).toBe(once);
  });

  test("strips query/hash before matching the route, keeps them in the output", () => {
    const body = "[intro](/introduction?tab=cli#setup)";
    expect(rewriteBodyLinks(body, "/docs", routes)).toBe(
      "[intro](/docs/introduction?tab=cli#setup)",
    );
  });

  test("no-op when base is empty", () => {
    const body = "[intro](/introduction)";
    expect(rewriteBodyLinks(body, "", routes)).toBe(body);
  });
});
