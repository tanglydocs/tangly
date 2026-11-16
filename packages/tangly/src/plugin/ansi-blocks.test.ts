import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs runtime modules, no declarations
import remarkAnsi, { normalizeAnsi } from "../../runtime/src/lib/remark-ansi.mjs";
// @ts-expect-error — .mjs runtime modules, no declarations
import { transformerTanglyChrome } from "../../runtime/src/lib/shiki-transformers.mjs";
import { stripAnsi, stripMarkers } from "../../../theme-ui/src/scripts/code-copy";

const ESC = "\u001b";

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkAnsi)
    .use(remarkRehype)
    .use(rehypeShiki, {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      transformers: [transformerTanglyChrome({ copyButton: true, chrome: "bar" })],
    })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe("normalizeAnsi", () => {
  it.each([
    ["\\e[31mx", `${ESC}[31mx`],
    ["\\x1b[31mx", `${ESC}[31mx`],
    ["\\x1B[31mx", `${ESC}[31mx`],
    ["\\u001b[31mx", `${ESC}[31mx`],
    ["\\033[31mx", `${ESC}[31mx`],
  ])("converts %j", (input, expected) => {
    expect(normalizeAnsi(input)).toBe(expected);
  });

  it("leaves a textual escape alone unless a [ follows", () => {
    expect(normalizeAnsi("\\e and \\033 and C:\\path")).toBe("\\e and \\033 and C:\\path");
  });

  it("keeps real ESC bytes and SGR sequences", () => {
    const s = `${ESC}[1;38;2;1;2;3mhi${ESC}[0m`;
    expect(normalizeAnsi(s)).toBe(s);
  });

  it("drops non-SGR control sequences and OSC hyperlinks", () => {
    const s = `a${ESC}[2Kb${ESC}[?25lc${ESC}]8;;http://x\u0007link${ESC}]8;;\u0007${ESC}[32mg`;
    expect(normalizeAnsi(s)).toBe(`abclink${ESC}[32mg`);
  });

  it("normalises CRLF", () => {
    expect(normalizeAnsi("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("ansi fences end to end", () => {
  it("renders colours, bold, dim, italic, underline for light and dark", async () => {
    const src = [
      "\\e[31mred\\e[0m",
      "\\e[92mbright\\e[0m",
      "\\e[38;5;208mc256\\e[0m",
      "\\e[38;2;10;200;120mtrue\\e[0m",
      "\\e[1mbold\\e[0m",
      "\\e[2mdim\\e[0m",
      "\\e[3mital\\e[0m",
      "\\e[4munder\\e[0m",
      "\\e[41mbg\\e[0m plain",
    ].join("\n");
    const html = await render('```ansi title="Terminal"\n' + src + "\n```");
    expect(html).toContain('data-language="ansi"');
    expect(html).toContain("tangly-code-figure");
    // Dual-theme variables, distinct per theme for the 16 colours.
    expect(html).toMatch(/--shiki-light:#d73a49;--shiki-dark:#[0-9a-f]{6}">red/);
    expect(html).toContain("--shiki-light:#22863a"); // bright green
    expect(html).toContain("#ff8700"); // 256-colour
    expect(html).toContain("#0ac878"); // truecolour
    expect(html).toContain("--shiki-light-font-weight:bold");
    expect(html).toContain("--shiki-light-font-style:italic");
    expect(html).toContain("--shiki-light-text-decoration:underline");
    expect(html).toMatch(/--shiki-light-bg:#d73a49[^"]*">bg/);
    // Reset: text after \e[0m is not coloured red.
    expect(html).not.toMatch(/#d73a49[^>]*> plain/);
    expect(html).not.toContain(ESC);
    expect(html).not.toContain("\\e[");
    // Copy button present, title shown.
    expect(html).toContain("data-tangly-copy");
    expect(html).toContain("Terminal");
  });

  it("accepts a bare title token in the fence meta", async () => {
    const html = await render("```ansi Terminal\n\\e[32mok\\e[0m\n```");
    expect(html).toContain("tangly-code-title");
  });

  it("does not touch other languages", async () => {
    const html = await render("```ts\nconst a = '\\e[31m';\n```");
    // Tokens split the text across spans; strip tags to compare the source.
    expect(html.replace(/<[^>]+>/g, "")).toContain("'\\e[31m'");
  });
});

describe("copy text", () => {
  it("strips escape codes", () => {
    expect(stripAnsi(`${ESC}[1;31merror${ESC}[0m: ${ESC}[2Kdone`)).toBe("error: done");
  });

  it("strips escapes and notation markers together", () => {
    expect(stripMarkers(`${ESC}[32mok${ESC}[0m // [!code highlight]`)).toBe("ok");
  });
});
