import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDocsJson, safeParseDocsJson } from "./docs-json.js";
import { convertMintToDocs, type MintJson } from "./mint-json.js";
import { isPathSafe, resolveJsonPointer } from "./ref-resolve.js";

describe("DocsJsonSchema", () => {
  test("parses Opennem docs.json", () => {
    const path = resolve(import.meta.dirname, "../../../examples/opennem/docs.json");
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      // fall back to bundled fixture path used in CI
      raw = readFileSync(resolve(import.meta.dirname, "../fixtures/opennem-docs.json"), "utf8");
    }
    const result = safeParseDocsJson(JSON.parse(raw));
    if (!result.success) {
      console.error(result.error.format());
    }
    expect(result.success).toBe(true);
  });

  test("rejects missing name", () => {
    const result = safeParseDocsJson({ navigation: { pages: ["a"] } });
    expect(result.success).toBe(false);
  });

  test("accepts minimal valid config", () => {
    const result = safeParseDocsJson({
      name: "Test",
      navigation: { pages: ["index"] },
    });
    expect(result.success).toBe(true);
  });

  test("parses recursive nav (tabs > groups > pages)", () => {
    const cfg = parseDocsJson({
      name: "Test",
      navigation: {
        tabs: [
          {
            tab: "Docs",
            groups: [
              {
                group: "Getting Started",
                pages: [
                  "intro",
                  {
                    group: "Nested",
                    pages: ["nested/a", "nested/b"],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(cfg.navigation.tabs).toHaveLength(1);
    const firstTab = cfg.navigation.tabs?.[0];
    expect(firstTab?.tab).toBe("Docs");
  });
});

describe("convertMintToDocs", () => {
  test("migrates a basic mint.json", () => {
    const mint: MintJson = {
      name: "Old Project",
      logo: "/logo.svg",
      colors: { primary: "#ff0000" },
      navigation: [{ group: "Get Started", pages: ["intro", "install"] }],
      anchors: [{ name: "GitHub", url: "https://github.com", icon: "github" }],
    };
    const docs = convertMintToDocs(mint);
    expect(docs.name).toBe("Old Project");
    expect(docs.theme).toBe("tang");
    expect(docs.navigation.groups).toHaveLength(1);
    expect(docs.navigation.global?.anchors).toHaveLength(1);
  });
});

describe("ref-resolve", () => {
  test("isPathSafe rejects traversal", () => {
    expect(isPathSafe("../../etc/passwd", "/project")).toBe(false);
    expect(isPathSafe("snippets/foo.mdx", "/project")).toBe(true);
  });

  test("resolveJsonPointer walks fragments", () => {
    const doc = { a: { b: { c: 42 } } };
    expect(resolveJsonPointer(doc, "#/a/b/c")).toBe(42);
    expect(resolveJsonPointer(doc, "#/a")).toEqual({ b: { c: 42 } });
  });
});
