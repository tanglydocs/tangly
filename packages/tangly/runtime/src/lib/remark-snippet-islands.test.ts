import { describe, expect, test } from "vitest";
// @ts-expect-error — plain .mjs remark plugin, no types
import remarkSnippetIslands from "./remark-snippet-islands.mjs";

interface JsxAttr {
  type: string;
  name: string;
  value: unknown;
}
interface Node {
  type: string;
  name?: string;
  value?: string;
  attributes?: JsxAttr[];
  children?: Node[];
  data?: { estree?: { body: unknown[] } };
}

function run(tree: Node): Node {
  remarkSnippetIslands()(tree);
  return tree;
}

function el(name: string, attributes: JsxAttr[] = []): Node {
  return { type: "mdxJsxFlowElement", name, attributes, children: [] };
}

function esm(value: string): Node {
  return { type: "mdxjsEsm", value };
}

const hasClientVisible = (n: Node) => (n.attributes ?? []).some((a) => a.name === "client:visible");

describe("remarkSnippetIslands", () => {
  test("tags a jsx-snippet element with client:visible, leaves others alone", () => {
    const demo = el("IframeDemo");
    const note = el("Note");
    run({
      type: "root",
      children: [esm('import { IframeDemo } from "/snippets/IframeDemo.jsx";'), demo, note],
    });
    expect(hasClientVisible(demo)).toBe(true);
    expect(hasClientVisible(note)).toBe(false);
  });

  test("ignores .mdx snippet imports (content, not islands)", () => {
    const frag = el("Disclaimer");
    run({
      type: "root",
      children: [esm('import Disclaimer from "/snippets/disclaimer.mdx";'), frag],
    });
    expect(hasClientVisible(frag)).toBe(false);
  });

  test("respects an author-supplied client directive", () => {
    const demo = el("IframeDemo", [{ type: "mdxJsxAttribute", name: "client:load", value: null }]);
    run({
      type: "root",
      children: [esm('import { IframeDemo } from "/snippets/IframeDemo.jsx";'), demo],
    });
    expect(hasClientVisible(demo)).toBe(false);
    expect((demo.attributes ?? []).filter((a) => a.name.startsWith("client:"))).toHaveLength(1);
  });

  test("handles default + tsx imports and the estree path", () => {
    const a = el("Widget");
    const b = el("Chart");
    run({
      type: "root",
      children: [
        esm('import Widget from "/snippets/Widget.jsx";'),
        {
          type: "mdxjsEsm",
          value: "",
          data: {
            estree: {
              body: [
                {
                  type: "ImportDeclaration",
                  source: { value: "/snippets/Chart.tsx" },
                  specifiers: [{ local: { name: "Chart" } }],
                },
              ],
            },
          },
        },
        a,
        b,
      ],
    });
    expect(hasClientVisible(a)).toBe(true);
    expect(hasClientVisible(b)).toBe(true);
  });

  test("no-op when there are no snippet imports", () => {
    const note = el("Note");
    run({ type: "root", children: [esm('import { foo } from "../lib/foo.js";'), note] });
    expect(hasClientVisible(note)).toBe(false);
  });
});
