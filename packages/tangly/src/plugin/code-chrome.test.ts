import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs runtime module, no declarations
import { transformerTanglyChrome } from "../../runtime/src/lib/shiki-transformers.mjs";

// The transformer is a shiki hook: it reads the fence meta off `this.options`
// and rewrites the hast root in place. Drive it directly rather than booting
// shiki, so a case costs one call.
function run(meta: string, opts: Record<string, unknown> = {}, lang = "ts") {
  const pre = {
    type: "element",
    tagName: "pre",
    properties: { className: ["shiki"] },
    children: [{ type: "element", tagName: "code", properties: {}, children: [] }],
  };
  const root = { type: "root", children: [pre] };
  const transformer = transformerTanglyChrome(opts);
  transformer.root.call({ options: { meta: { __raw: meta }, lang } }, root);
  return root.children[0];
}

const classesOf = (node: any) => (node?.properties?.className ?? []) as string[];
const find = (node: any, className: string): any => {
  if (classesOf(node).includes(className)) return node;
  for (const child of node?.children ?? []) {
    const hit = find(child, className);
    if (hit) return hit;
  }
  return undefined;
};

describe("transformerTanglyChrome", () => {
  it("bar chrome wraps in a figure with a header", () => {
    const out = run('title="fetch.ts"');
    expect(out.tagName).toBe("figure");
    expect(out.properties["data-chrome"]).toBe("bar");
    expect(find(out, "tangly-code-header")).toBeDefined();
    expect(find(out, "tangly-code-copy")).toBeDefined();
  });

  it("bare chrome drops the header and floats copy on the figure", () => {
    const out = run('title="fetch.ts" bare');
    expect(out.tagName).toBe("figure");
    expect(out.properties["data-chrome"]).toBe("bare");
    expect(find(out, "tangly-code-header")).toBeUndefined();
    // Direct child of the figure, which is what the floating CSS selects.
    expect(classesOf(out.children[1])).toContain("tangly-code-copy");
  });

  it("a fence flag overrides the site default in both directions", () => {
    expect(run("", { chrome: "bare" }).properties["data-chrome"]).toBe("bare");
    expect(run("bar", { chrome: "bare" }).properties["data-chrome"]).toBe("bar");
  });

  // Regression: bare mode suppresses title and lang, so with copy off there is
  // nothing to add and the early-out used to skip the figure entirely. Every
  // block on a `chrome: "bare", copyButton: false` site lost its border,
  // background and annotation pairing.
  it("bare chrome still emits a figure when the copy button is off", () => {
    const viaConfig = run('title="fetch.ts"', { chrome: "bare", copyButton: false });
    expect(viaConfig.tagName).toBe("figure");
    expect(find(viaConfig, "tangly-code-copy")).toBeUndefined();

    const viaFence = run("bare noCopy");
    expect(viaFence.tagName).toBe("figure");
    expect(find(viaFence, "tangly-code-copy")).toBeUndefined();
  });

  // No title, no lang label, no button: bar mode has nothing to wrap with.
  it("bar chrome with nothing to show leaves the pre alone", () => {
    const out = run("noCopy", { chrome: "bar" }, "");
    expect(out.tagName).toBe("pre");
  });
});

describe("transformerTanglyChrome tab titles", () => {
  const titleOf = (meta: string) =>
    find(run(meta, {}, "bash"), "tangly-code-title")?.children[1]?.value;

  // ```bash macOS / Linux: Mintlify keeps the whole title, and CodeGroup tabs
  // read it back from data-filename.
  it("keeps a multi-word title after the language", () => {
    expect(titleOf("macOS / Linux")).toBe("macOS / Linux");
    expect(titleOf("Windows (PowerShell)")).toBe("Windows (PowerShell)");
  });

  it("stops the title at flags, ranges and key=val pairs", () => {
    expect(titleOf("macOS / Linux {1,3} noCopy")).toBe("macOS / Linux");
    expect(titleOf("noCopy my file")).toBe("my file");
    expect(titleOf("npm lines=2")).toBe("npm");
  });

  it("single-token titles are unchanged", () => {
    expect(titleOf("package.json")).toBe("package.json");
    expect(run("macOS / Linux", {}, "bash").children[1].properties["data-filename"]).toBe(
      "macOS / Linux",
    );
  });
});

// A CodeGroup hides its per-block header chrome (tabs replace the title) but
// must keep the Copy button reachable in both chromes. CSS can't be rendered
// here, so pin the contract: no rule may display:none the copy button or its
// whole header inside a group, and both the hover reveal and the touch
// fallback must cover grouped blocks.
describe("CodeGroup copy button CSS", () => {
  const css = readFileSync(
    new URL("../../../theme-ui/src/styles/code.css", import.meta.url),
    "utf8",
  );
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    body: m[2]!,
  }));

  it("never hides the copy button or the header shell inside a group", () => {
    for (const { selector, body } of rules) {
      if (!selector.includes(".tangly-code-group") || !/display:\s*none/.test(body)) continue;
      for (const sel of selector.split(",").map((s) => s.trim())) {
        expect(sel).not.toMatch(/tangly-code-copy\s*$/);
        expect(sel).not.toMatch(/tangly-code-header\s*$/);
      }
    }
  });

  it("floats the copy button over the code in a group and honours copyButton: hover", () => {
    expect(css).toMatch(
      /\.tangly-code-group \.tangly-code-figure > \.tangly-code-header \{[^}]*position: absolute/,
    );
    expect(css).toContain(
      ':root[data-copy="hover"] .tangly-code-group .tangly-code-figure:focus-within .tangly-code-copy',
    );
    expect(css).toMatch(
      /@media \(hover: none\) \{\s*:root\[data-copy="hover"\] \.tangly-code-group/,
    );
  });
});
