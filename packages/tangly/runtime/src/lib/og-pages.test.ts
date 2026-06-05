import { describe, expect, it } from "vitest";
import type { PageEntry } from "tangly";
import {
  apiAttrOf,
  hasExplicitTitle,
  operationMeta,
  parseApiAttr,
  type RoutablePage,
} from "./og-pages.ts";

describe("parseApiAttr", () => {
  it("splits METHOD path and lowercases the method", () => {
    expect(parseApiAttr("GET /users/{id}")).toEqual({ method: "get", path: "/users/{id}" });
  });

  it("collapses extra whitespace and rejoins a spaced path tail", () => {
    expect(parseApiAttr("  POST   /a b ")).toEqual({ method: "post", path: "/a b" });
  });

  it("returns null for empty, single-token, or missing input", () => {
    expect(parseApiAttr(undefined)).toBeNull();
    expect(parseApiAttr("")).toBeNull();
    expect(parseApiAttr("GET")).toBeNull();
  });
});

describe("operationMeta", () => {
  const doc = {
    paths: {
      "/users/{id}": {
        get: { summary: "Fetch a user", description: "Returns one user." },
      },
    },
  };

  it("pulls summary/description for the matching method+path", () => {
    expect(operationMeta(doc, "get", "/users/{id}")).toEqual({
      title: "Fetch a user",
      description: "Returns one user.",
    });
  });

  it("returns undefined fields when the op, path, or doc is absent", () => {
    expect(operationMeta(doc, "post", "/users/{id}")).toEqual({
      title: undefined,
      description: undefined,
    });
    expect(operationMeta(null, "get", "/x")).toEqual({ title: undefined, description: undefined });
  });
});

// Minimal builders — the helpers only read a few fields, so cast loosely.
function entryPage(data: Record<string, unknown>): RoutablePage {
  return { slug: "ep", entry: { id: "ep", data } as never, synthPage: null };
}
function synthPage(frontmatter: Record<string, unknown>): RoutablePage {
  return { slug: "sp", entry: null, synthPage: { frontmatter } as unknown as PageEntry };
}
function meta(frontmatter: Record<string, unknown>): PageEntry {
  return { frontmatter } as unknown as PageEntry;
}

describe("apiAttrOf", () => {
  it("prefers entry.openapi over api, then manifest, then synth", () => {
    expect(apiAttrOf(entryPage({ openapi: "GET /a", api: "POST /b" }), undefined)).toBe("GET /a");
    expect(apiAttrOf(entryPage({ api: "POST /b" }), undefined)).toBe("POST /b");
    expect(
      apiAttrOf({ slug: "x", entry: null, synthPage: null }, meta({ openapi: "PUT /c" })),
    ).toBe("PUT /c");
    expect(apiAttrOf(synthPage({ api: "DELETE /d" }), undefined)).toBe("DELETE /d");
  });

  it("returns undefined when no api/openapi attr exists", () => {
    expect(apiAttrOf(entryPage({ title: "Plain" }), undefined)).toBeUndefined();
  });
});

describe("hasExplicitTitle", () => {
  it("is true when any of entry/manifest/synth declares a title", () => {
    expect(hasExplicitTitle(entryPage({ title: "T" }), undefined)).toBe(true);
    expect(
      hasExplicitTitle({ slug: "x", entry: null, synthPage: null }, meta({ title: "T" })),
    ).toBe(true);
    expect(hasExplicitTitle(synthPage({ title: "T" }), undefined)).toBe(true);
  });

  it("is false when no source declares a title (slug-fallback path)", () => {
    expect(hasExplicitTitle(entryPage({ openapi: "GET /a" }), undefined)).toBe(false);
  });
});
