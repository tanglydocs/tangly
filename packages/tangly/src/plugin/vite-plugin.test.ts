import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { tanglyVitePlugin } from "./vite-plugin.js";

const USER_ROOT = "/tmp/tangly-vite-plugin-test-proj";
const snip = (rel: string) => resolve(USER_ROOT, "snippets", rel);

// The transform hook is a plain function on the returned plugin. Invoke it
// directly — these branches are pure (no filesystem access).
function transform(code: string, id: string): { code: string } | null {
  const plugin = tanglyVitePlugin({ userRoot: USER_ROOT });
  const fn = plugin.transform as (this: unknown, code: string, id: string) => unknown;
  return fn.call({}, code, id) as { code: string } | null;
}

describe("tanglyVitePlugin transform — JSX snippets", () => {
  test("injects React hook import into a /snippets/*.jsx file", () => {
    const out = transform("export const X = () => { const [a] = useState(0); };", snip("X.jsx"));
    expect(out?.code).toContain('from "react"');
    expect(out?.code).toContain("useState");
    expect(out?.code).toContain("export const X");
  });

  test("injects into .tsx snippets too", () => {
    const out = transform("export const Y = () => null;", snip("Y.tsx"));
    expect(out?.code.startsWith("import React")).toBe(true);
  });

  test("does NOT inject when the snippet already imports react", () => {
    const code = 'import { useState } from "react";\nexport const Z = () => null;';
    expect(transform(code, snip("Z.jsx"))).toBeNull();
  });

  test("does NOT inject when the snippet imports preact directly", () => {
    const code = 'import { useState } from "preact/hooks";\nexport const Z = () => null;';
    expect(transform(code, snip("Z.jsx"))).toBeNull();
  });

  test("ignores jsx files outside the snippets dir", () => {
    const out = transform("export const A = () => null;", resolve(USER_ROOT, "src/A.jsx"));
    expect(out).toBeNull();
  });
});

describe("tanglyVitePlugin transform — Tailwind @source", () => {
  test("appends a snippets @source to the tailwind css entry", () => {
    const out = transform('@import "tailwindcss";\n.foo{}', "/x/theme.css");
    expect(out?.code).toContain("@source");
    expect(out?.code).toContain("/snippets/**/*.{jsx,tsx,mdx}");
  });

  test("does not touch css without the tailwind import", () => {
    expect(transform(".foo{ color: red }", "/x/plain.css")).toBeNull();
  });

  test("is idempotent — does not append twice", () => {
    const once = transform('@import "tailwindcss";', "/x/theme.css");
    const twice = transform(once?.code ?? "", "/x/theme.css");
    expect(twice).toBeNull();
  });
});

describe("tanglyVitePlugin transform — passthrough", () => {
  test("leaves unrelated .ts files untouched", () => {
    expect(transform("export const a = 1;", resolve(USER_ROOT, "foo.ts"))).toBeNull();
  });

  test("still rewrites <latex> in mdx (existing behavior preserved)", () => {
    const out = transform("# Hi\n<latex>x^2</latex>\n", resolve(USER_ROOT, "page.mdx"));
    expect(out?.code).toContain("$$");
    expect(out?.code).not.toContain("<latex>");
  });
});
