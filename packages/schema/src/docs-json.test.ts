import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDocsJson, safeParseDocsJson } from "./docs-json.js";
import { convertMintToDocs, type MintJson } from "./mint-json.js";
import { isPathSafe, resolveJsonPointer } from "./ref-resolve.js";

describe("DocsJsonSchema", () => {
  test("parses Opennem docs.json", () => {
    const raw = readFileSync(resolve(import.meta.dirname, "../fixtures/opennem-docs.json"), "utf8");
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
      // `perplexity` et al. are now valid Mintlify presets; use a bogus action.
      contextual: { options: ["copy", "not-a-real-action"] },
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

// Regression coverage for Mintlify-compat gaps reported in issue #6: real
// `docs.json` configs that strict parsing rejected. Each shape below is taken
// straight from Mintlify's published schema (mintlify.com/docs.json).
describe("Mintlify compat (issue #6)", () => {
  const base = { name: "Test", navigation: { pages: ["index"] } } as const;
  const ok = (extra: Record<string, unknown>) =>
    expect(safeParseDocsJson({ ...base, ...extra }).success).toBe(true);

  test("nav group may omit pages; nested groups go inside pages", () => {
    // Mintlify nests groups as entries inside `pages` (a group has no `groups`
    // key); `Reference only` exercises the pages-less case.
    ok({
      navigation: {
        tabs: [
          {
            tab: "Guides",
            groups: [
              { group: "With pages", pages: ["a"] },
              { group: "Reference only" },
              { group: "Nested", pages: [{ group: "Sub", pages: ["b"] }] },
            ],
          },
        ],
      },
    });
  });

  test("a pages-less group resolves without throwing", () => {
    // Guards resolve-nav's buildSidebar(undefined) path.
    const cfg = parseDocsJson({
      ...base,
      navigation: { groups: [{ group: "Empty" }, { group: "Full", pages: ["a"] }] },
    });
    expect(cfg.navigation.groups).toHaveLength(2);
  });

  test("banner accepts critical tone and color override", () => {
    ok({ banner: { content: "hi", type: "critical", color: { light: "#fff", dark: "#000" } } });
  });

  test("errors.404 accepts title + description", () => {
    ok({ errors: { "404": { redirect: false, title: "Nope", description: "Gone." } } });
  });

  test("icons.library accepts tabler", () => {
    ok({ icons: { library: "tabler" } });
  });

  test("background.image accepts a light/dark pair", () => {
    ok({ background: { image: { light: "a.png", dark: "b.png" } } });
  });

  test("styling.codeblocks accepts a { theme } object", () => {
    ok({ styling: { codeblocks: { theme: "dracula" } } });
    ok({ styling: { codeblocks: { theme: { light: "github-light", dark: "github-dark" } } } });
  });

  test("bare font-face expands to heading + body", () => {
    const cfg = parseDocsJson({ ...base, fonts: { family: "Inter", weight: 500 } });
    const fonts = cfg.fonts as { heading?: { family?: string }; body?: { family?: string } };
    expect(fonts.heading?.family).toBe("Inter");
    expect(fonts.body?.family).toBe("Inter");
  });

  test("split { heading, body } fonts still parse unchanged", () => {
    ok({ fonts: { heading: { family: "Lora" }, body: { family: "Inter" } } });
  });

  test("api.playground.display normalizes to native mode", () => {
    const cfg = parseDocsJson({ ...base, api: { playground: { display: "none" } } });
    expect(cfg.api?.playground?.mode).toBe("hide");
  });
});

// Gaps surfaced by a wider GitHub corpus (see fixtures/mintlify/*). Each shape
// is taken from a real published config that previously failed strict parsing.
describe("Mintlify compat (corpus expansion)", () => {
  const base = { name: "Test", navigation: { pages: ["index"] } } as const;
  const ok = (extra: Record<string, unknown>) =>
    expect(safeParseDocsJson({ ...base, ...extra }).success).toBe(true);

  test("navbar link: social shorthand (type, no label) + primary CTA", () => {
    ok({
      navbar: {
        links: [
          { type: "github", href: "https://github.com/x" },
          { label: "Support", href: "/support", primary: true },
        ],
      },
    });
  });

  test("api.auth.default (playground prefill)", () => {
    ok({ api: { auth: { method: "key", name: "x-api-key", default: "demo-key" } } });
  });

  test("contextual.display", () => {
    ok({ contextual: { options: ["copy"], display: "toc" } });
  });

  test("thumbnails.appearance + fonts", () => {
    ok({ thumbnails: { appearance: "dark", fonts: { family: "Open Sans" } } });
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

  test("translates api.playground.display into native mode", () => {
    const docs = convertMintToDocs({
      name: "API Project",
      navigation: [{ group: "G", pages: ["x"] }],
      api: { baseUrl: "https://api.example.com", playground: { display: "none" } },
    });
    expect(docs.api?.playground?.mode).toBe("hide");
    expect((docs.api?.playground as Record<string, unknown> | undefined)?.display).toBeUndefined();
    // Generated docs.json must validate against the strict schema.
    expect(safeParseDocsJson(docs).success).toBe(true);
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

  test("aliases api.playground.display → mode (none→hide, auth→interactive)", () => {
    const hide = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: { playground: { display: "none", credentials: true } },
    });
    expect(hide.api?.playground?.mode).toBe("hide");
    // credentials/proxy survive the rewrite; raw `display` is stripped.
    expect(hide.api?.playground?.credentials).toBe(true);
    expect((hide.api?.playground as Record<string, unknown> | undefined)?.display).toBeUndefined();

    const auth = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: { playground: { display: "auth" } },
    });
    expect(auth.api?.playground?.mode).toBe("interactive");

    for (const v of ["interactive", "simple"] as const) {
      const cfg = parseDocsJson({
        name: "T",
        navigation: { pages: ["x"] },
        api: { playground: { display: v } },
      });
      expect(cfg.api?.playground?.mode).toBe(v);
    }
  });

  test("native api.playground.mode wins over display", () => {
    const cfg = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: { playground: { mode: "simple", display: "none" } },
    });
    expect(cfg.api?.playground?.mode).toBe("simple");
    expect((cfg.api?.playground as Record<string, unknown> | undefined)?.display).toBeUndefined();
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

  test("accepts api.mdx.auth (Mintlify MDX-page default auth)", () => {
    const cfg = parseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      api: { mdx: { auth: { method: "bearer", name: "Authorization" } } },
    });
    expect((cfg.api?.mdx as { auth?: { method?: string } } | undefined)?.auth?.method).toBe(
      "bearer",
    );
  });
});

describe("contextual.options (Mintlify parity)", () => {
  test("accepts Mintlify's full preset set + Tangly-native copy-url", () => {
    const result = safeParseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      contextual: {
        options: ["copy", "copy-url", "view", "perplexity", "cursor", "vscode", "mcp", "claude"],
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts custom-object actions alongside string presets", () => {
    const result = safeParseDocsJson({
      name: "T",
      navigation: { pages: ["x"] },
      contextual: {
        options: [
          "copy",
          { title: "Open in Playground", href: "https://example.com", icon: "play" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  test("custom-object actions require none of title/icon/href", () => {
    // Mintlify marks every key optional; e.g. an href-only action.
    expect(
      safeParseDocsJson({
        name: "T",
        navigation: { pages: ["x"] },
        contextual: { options: [{ href: "https://example.com" }] },
      }).success,
    ).toBe(true);
    expect(
      safeParseDocsJson({
        name: "T",
        navigation: { pages: ["x"] },
        contextual: { options: [{ title: "Just a title" }] },
      }).success,
    ).toBe(true);
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
