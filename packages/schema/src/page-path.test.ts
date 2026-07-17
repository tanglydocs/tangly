import { describe, expect, test } from "vitest";
import { pagePathForSlug, pageRouteForSlug } from "./page-path.js";

describe("pageRouteForSlug", () => {
  test("root index.mdx maps to /", () => {
    expect(pageRouteForSlug("index")).toBe("/");
    expect(pageRouteForSlug("")).toBe("/");
  });

  test("nested index.mdx maps to its directory route", () => {
    // scan-pages already collapses `cli/index` → `cli`; both spellings must
    // resolve to the same served route regardless of which caller we get.
    expect(pageRouteForSlug("cli")).toBe("/cli");
    expect(pageRouteForSlug("cli/index")).toBe("/cli");
    expect(pageRouteForSlug("guides/deploying/index")).toBe("/guides/deploying");
  });

  test("'index' inside a segment name is not stripped", () => {
    expect(pageRouteForSlug("indexing")).toBe("/indexing");
    expect(pageRouteForSlug("api/index-tuning")).toBe("/api/index-tuning");
  });

  test("ordinary pages keep their slug", () => {
    expect(pageRouteForSlug("introduction")).toBe("/introduction");
    expect(pageRouteForSlug("guides/deploying")).toBe("/guides/deploying");
  });

  test("stray slashes are trimmed", () => {
    expect(pageRouteForSlug("/introduction/")).toBe("/introduction");
    expect(pageRouteForSlug("/index")).toBe("/");
  });
});

describe("pagePathForSlug", () => {
  test("no base", () => {
    expect(pagePathForSlug("index")).toBe("/");
    expect(pagePathForSlug("cli")).toBe("/cli");
  });

  test("base prefix, home collapses to the base itself", () => {
    expect(pagePathForSlug("index", "/docs")).toBe("/docs");
    expect(pagePathForSlug("cli", "/docs")).toBe("/docs/cli");
  });
});
