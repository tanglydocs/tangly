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

  test("contextual.options accepts every documented action", () => {
    const result = safeParseDocsJson({
      name: "Test",
      navigation: { pages: ["index"] },
      contextual: { options: ["copy", "copy-url", "view", "chatgpt", "claude"] },
    });
    expect(result.success).toBe(true);
  });

  test("contextual.options rejects unknown actions", () => {
    const result = safeParseDocsJson({
      name: "Test",
      navigation: { pages: ["index"] },
      contextual: { options: ["copy", "perplexity"] },
    });
    expect(result.success).toBe(false);
  });

  test("contextual.options accepts an empty array (menu hidden)", () => {
    const result = safeParseDocsJson({
      name: "Test",
      navigation: { pages: ["index"] },
      contextual: { options: [] },
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

describe("ApiSchema (codeSamples + Mintlify aliases)", () => {
  test("accepts codeSamples + params + url + playground.credentials", () => {
    const result = safeParseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: {
        codeSamples: {
          languages: ["curl", "typescript", "python"],
          autogenerate: true,
          prefill: true,
          defaults: "required",
        },
        params: { expanded: "all", post: ["read-only"] },
        url: "full",
        playground: { mode: "interactive", proxy: false, credentials: true },
      },
    });
    expect(result.success).toBe(true);
  });

  test("aliases api.examples → api.codeSamples", () => {
    const cfg = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: { examples: { languages: ["curl", "go"], prefill: false } },
    });
    expect(cfg.api?.codeSamples?.languages).toEqual(["curl", "go"]);
    expect(cfg.api?.codeSamples?.prefill).toBe(false);
    // raw `examples` is stripped after normalization
    expect((cfg.api as Record<string, unknown>).examples).toBeUndefined();
  });

  test("native codeSamples wins over examples on conflict", () => {
    const cfg = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: {
        examples: { languages: ["mint-only"] },
        codeSamples: { languages: ["tang-wins"] },
      },
    });
    expect(cfg.api?.codeSamples?.languages).toEqual(["tang-wins"]);
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
