import { describe, expect, test } from "vitest";
// @ts-expect-error — plain .mjs recma plugin, no types
import recmaSnippetComponents from "./recma-snippet-components.mjs";

/* Minimal estree builders mirroring the MDX compiler output. */
type Node = Record<string, unknown>;

function importDecl(local: string, source: string): Node {
  return {
    type: "ImportDeclaration",
    source: { type: "Literal", value: source },
    specifiers: [{ type: "ImportDefaultSpecifier", local: { type: "Identifier", name: local } }],
  };
}

function obj(props: Node[] = []): Node {
  return { type: "ObjectExpression", properties: props };
}

function jsxCall(name: string, propsArg?: Node, callee = "_jsx"): Node {
  const args: Node[] = [{ type: "Identifier", name }];
  if (propsArg !== undefined) args.push(propsArg);
  return { type: "CallExpression", callee: { type: "Identifier", name: callee }, arguments: args };
}

function run(body: Node[]): Node[] {
  const tree = { type: "Program", body };
  recmaSnippetComponents()(tree);
  return body;
}

function componentsProp(call: Node): Node | undefined {
  const props = ((call.arguments as Node[])[1]?.properties ?? []) as Node[];
  return props.find((p) => (p.key as Node)?.name === "components");
}

describe("recmaSnippetComponents", () => {
  test("injects components={props.components} into an .mdx-import jsx call", () => {
    const call = jsxCall("NoteSnip", obj());
    run([importDecl("NoteSnip", "/snippets/note.mdx"), call]);
    const prop = componentsProp(call);
    expect(prop).toBeDefined();
    const value = prop?.value as Node;
    expect((value.object as Node).name).toBe("props");
    expect((value.property as Node).name).toBe("components");
  });

  test("adds a props object when the call has only one argument", () => {
    const call = jsxCall("NoteSnip");
    run([importDecl("NoteSnip", "/snippets/note.mdx"), call]);
    expect((call.arguments as Node[]).length).toBe(2);
    expect(componentsProp(call)).toBeDefined();
  });

  test("ignores .jsx/.tsx imports (those are islands, not MDX)", () => {
    const call = jsxCall("Widget", obj());
    run([importDecl("Widget", "/snippets/widget.jsx"), call]);
    expect(componentsProp(call)).toBeUndefined();
  });

  test("does not override an explicit components prop", () => {
    const explicit = {
      type: "Property",
      key: { type: "Identifier", name: "components" },
      value: { type: "Identifier", name: "myComps" },
    };
    const call = jsxCall("NoteSnip", obj([explicit]));
    run([importDecl("NoteSnip", "/snippets/note.mdx"), call]);
    const props = (call.arguments as Node[])[1]?.properties as Node[];
    expect(props.filter((p) => (p.key as Node)?.name === "components")).toHaveLength(1);
    expect(((props[0] as Node).value as Node).name).toBe("myComps");
  });

  test("handles _jsxs and leaves non-jsx callees alone", () => {
    const jsxs = jsxCall("NoteSnip", obj(), "_jsxs");
    const other = jsxCall("NoteSnip", obj(), "_createMdxContent");
    run([importDecl("NoteSnip", "/snippets/note.mdx"), jsxs, other]);
    expect(componentsProp(jsxs)).toBeDefined();
    expect(componentsProp(other)).toBeUndefined();
  });

  test("no-op when no .mdx imports are present", () => {
    const call = jsxCall("Thing", obj());
    run([importDecl("Thing", "../lib/thing.js"), call]);
    expect(componentsProp(call)).toBeUndefined();
  });
});
