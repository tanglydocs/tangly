import { describe, expect, test } from "vitest";
import { safeParseDocsJson } from "./docs-json.js";
import {
  DocsJsonValidationError,
  formatDocsJsonError,
  formatJsonSyntaxError,
  parseDocsJsonOrThrow,
} from "./format-error.js";

/**
 * Validate `obj` and return the rendered (color-free) error block. Defaults
 * `raw` to the serialized object — the CLI always has the file text, which is
 * what enables offending-value display and did-you-mean suggestions.
 */
function render(obj: unknown, raw: string = JSON.stringify(obj, null, 2)): string {
  const result = safeParseDocsJson(obj);
  if (result.success) throw new Error("expected validation to fail");
  return formatDocsJsonError(result.error, { raw, file: "docs.json", color: false });
}

describe("formatDocsJsonError", () => {
  test("missing required key reads as 'missing required'", () => {
    const out = render({
      name: "T",
      navigation: { groups: [{ icon: "book" }] }, // group missing `group`
    });
    expect(out).toContain("navigation.groups[0].group");
    expect(out).toContain('missing required "group"');
  });

  test("unknown key is named, with the Mintlify rename hint for display", () => {
    const out = render({
      name: "T",
      navigation: { pages: ["index"] },
      api: { playground: { display: "simple", bogus: 1 } },
    });
    expect(out).toContain("api.playground");
    expect(out).toContain("unknown key");
    expect(out).toContain('"bogus"');
  });

  test("invalid enum value lists allowed options and suggests the nearest", () => {
    const out = render({
      name: "T",
      navigation: { pages: ["index"] },
      icons: { library: "lucid" },
    });
    expect(out).toContain("icons.library");
    expect(out).toContain('invalid value "lucid"');
    expect(out).toContain("allowed: lucide, fontawesome, tabler");
    expect(out).toContain('did you mean "lucide"?');
  });

  test("union-wrapped enum (contextual.options) still suggests the nearest", () => {
    const out = render({
      name: "T",
      navigation: { pages: ["index"] },
      contextual: { options: ["copy", "chatgptt"] },
    });
    expect(out).toContain("contextual.options[1]");
    expect(out).toContain('did you mean "chatgpt"?');
  });

  test("renders array indices as [i] and includes a line number from raw", () => {
    const obj = {
      name: "T",
      navigation: { tabs: [{ tab: "A", groups: [{ icon: "x" }] }] },
    };
    const raw = JSON.stringify(obj, null, 2);
    const rendered = render(obj, raw);
    expect(rendered).toContain("navigation.tabs[0].groups[0].group");
    expect(rendered).toMatch(/\(line \d+\)/);
  });

  test("header counts problems", () => {
    const out = render({ name: "T", navigation: { pages: ["index"] }, icons: { library: "x" } });
    expect(out).toMatch(/is not valid — 1 problem\b/);
  });
});

describe("parseDocsJsonOrThrow", () => {
  test("throws DocsJsonValidationError with a rendered message", () => {
    expect(() => parseDocsJsonOrThrow({ navigation: {} })).toThrow(DocsJsonValidationError);
    try {
      parseDocsJsonOrThrow({ navigation: { pages: ["x"] }, icons: { library: "nope" } });
    } catch (err) {
      expect(err).toBeInstanceOf(DocsJsonValidationError);
      expect((err as Error).message).toContain("icons.library");
    }
  });

  test("returns parsed config on success", () => {
    const cfg = parseDocsJsonOrThrow({ name: "T", navigation: { pages: ["index"] } });
    expect(cfg.name).toBe("T");
  });
});

describe("formatJsonSyntaxError", () => {
  test("points at the line/column when the engine reports a position", () => {
    const raw = '{\n  "name": "T",\n  "x": ,\n}';
    let msg = "";
    try {
      JSON.parse(raw);
    } catch (err) {
      msg = formatJsonSyntaxError(raw, err, { file: "docs.json", color: false });
    }
    expect(msg).toContain("not valid JSON");
    expect(msg).toContain("fix:");
  });
});
