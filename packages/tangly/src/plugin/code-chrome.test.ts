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
