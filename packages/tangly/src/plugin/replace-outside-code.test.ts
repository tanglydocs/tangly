import { describe, expect, test } from "vitest";
import { replaceOutsideCode } from "./replace-outside-code.js";

const latex = /<latex>([\s\S]*?)<\/latex>/gi;
const wrap = (_m: string, body: string) => `[${body.trim()}]`;
const imgRe = /!\[([^\]]*)\]\(\s*((?:\.\.\/)+)([^)\s]+)\)/g;
const imgReplacer = (_m: string, alt: string, _dots: string, rest: string) =>
  `![${alt}](/${rest})`;

describe("replaceOutsideCode", () => {

  test("rewrites outside backticks", () => {
    expect(replaceOutsideCode("hello <latex>x</latex> world", latex, wrap).value).toBe(
      "hello [x] world",
    );
  });

  test("preserves matches inside inline code spans", () => {
    expect(replaceOutsideCode("`<latex>x</latex>` becomes math", latex, wrap).value).toBe(
      "`<latex>x</latex>` becomes math",
    );
  });

  test("preserves matches inside double-backtick spans containing single backticks", () => {
    expect(replaceOutsideCode("``<latex>x</latex> ` more``", latex, wrap).value).toBe(
      "``<latex>x</latex> ` more``",
    );
  });

  test("preserves matches inside fenced code blocks", () => {
    const src = "before\n\n```\n<latex>x</latex>\n```\n\nafter <latex>y</latex>";
    expect(replaceOutsideCode(src, latex, wrap).value).toBe(
      "before\n\n```\n<latex>x</latex>\n```\n\nafter [y]",
    );
  });

  test("preserves matches inside tilde fences", () => {
    const src = "~~~mdx\n<latex>x</latex>\n~~~\n<latex>y</latex>";
    expect(replaceOutsideCode(src, latex, wrap).value).toBe("~~~mdx\n<latex>x</latex>\n~~~\n[y]");
  });

  test("indented fences (3-space lead) still considered code", () => {
    const src = "   ```\n<latex>x</latex>\n   ```\nfoo <latex>y</latex>";
    expect(replaceOutsideCode(src, latex, wrap).value).toBe(
      "   ```\n<latex>x</latex>\n   ```\nfoo [y]",
    );
  });

  test("the markdown image shim trigger pattern survives in code", () => {
    const src = "render `![alt](../foo/bar.png)` and ![alt](../foo/bar.png)";
    expect(replaceOutsideCode(src, imgRe, imgReplacer).value).toBe(
      "render `![alt](../foo/bar.png)` and ![alt](/foo/bar.png)",
    );
  });

  test("returns changed=false when no matches", () => {
    const r = replaceOutsideCode("nothing here", latex, wrap);
    expect(r.changed).toBe(false);
    expect(r.value).toBe("nothing here");
  });

  test("throws on non-global regex", () => {
    expect(() => replaceOutsideCode("x", /<latex>(.*?)<\/latex>/, wrap)).toThrow();
  });

  test("unclosed backtick run treated as literal — does not swallow remainder", () => {
    expect(replaceOutsideCode("` no close <latex>x</latex>", latex, wrap).value).toBe(
      "` no close [x]",
    );
  });
});
