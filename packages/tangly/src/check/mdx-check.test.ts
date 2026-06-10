import { describe, expect, test } from "vitest";
import { checkMdxSource, formatMdxIssue } from "./mdx-check.js";

const FM = "---\ntitle: Test\n---\n\n";

describe("checkMdxSource — unbound expression identifiers", () => {
  test("flags a literal {snake_case} placeholder in prose", () => {
    const issues = checkMdxSource(
      `${FM}Schema.org expects the {search_term_string} placeholder in your URL template.\n`,
      "rules/schema/website-search.mdx",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("search_term_string");
    expect(issues[0]!.hint).toContain("backticks");
    expect(issues[0]!.line).toBe(5);
  });

  test("does not flag placeholders inside inline code or fences", () => {
    const src = `${FM}Use \`{search_term_string}\` inline.\n\n\`\`\`\n{also_fine_here}\n\`\`\`\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("does not flag placeholders inside bare URLs (gfm autolink parity)", () => {
    // The build parses with remark-gfm, whose autolink-literal syntax wins
    // over JSX expressions — these build fine, so check must accept them.
    const src = `${FM}Set https://example.com/?q={search_term_string} in config.\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("allows identifiers bound by imports and exports", () => {
    const src = `${FM}import { PlanTable } from "/snippets/plans.mdx";\n\nexport const tier = "pro";\n\n{tier} works and <PlanTable /> renders.\n\nValue: {tier.toUpperCase()}\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("allows MDX-provided names and JS globals", () => {
    const src = `${FM}{frontmatter.title} — {props.foo} — {Math.max(1, 2)} — {JSON.stringify({ a: 1 })} — {new Date(0).getFullYear()}\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("understands expression-local bindings (arrow params, declarations)", () => {
    const src = `${FM}{[1, 2, 3].map((n) => n * 2).join(", ")}\n\n{(() => { const x = 5; return x + 1; })()}\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("flags unbound identifiers in JSX attribute expressions", () => {
    const src = `${FM}<img src={imageSrc} alt="x" />\n`;
    const issues = checkMdxSource(src, "a.mdx");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("imageSrc");
  });

  test("does not flag JSX component names (resolved via components map)", () => {
    const src = `${FM}<Note>Body</Note>\n\n{<Tip>inline</Tip>}\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("does not flag frontmatter content", () => {
    const src = `---\ntitle: Use {placeholders} carefully\n---\n\nProse.\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });

  test("template literals and member chains resolve against bindings", () => {
    const src = `${FM}export const base = "https://x.dev";\n\n{\`\${base}/docs\`}\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });
});

describe("checkMdxSource — syntax errors", () => {
  test("reports unclosed JSX tags with a position", () => {
    const issues = checkMdxSource(`${FM}<Note>\n\nNever closed.\n`, "broken.mdx");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.file).toBe("broken.mdx");
    expect(issues[0]!.line).toBeGreaterThan(0);
  });

  test("reports malformed expressions", () => {
    const issues = checkMdxSource(`${FM}Broken {a +} expression.\n`, "broken.mdx");
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("checkMdxSource — Mintlify source compat", () => {
  test("<latex> blocks survive (rewritten to math before parsing)", () => {
    const src = `${FM}<latex>\\frac{a}{b}</latex>\n`;
    expect(checkMdxSource(src, "a.mdx")).toEqual([]);
  });
});

describe("formatMdxIssue", () => {
  test("renders path:line:col, message, and hint", () => {
    const out = formatMdxIssue({
      file: "rules/x.mdx",
      line: 5,
      column: 52,
      message: "ReferenceError at build: `search_term_string` is not defined",
      hint: "MDX treats {…} as a JSX expression — wrap literal placeholders in backticks",
    });
    expect(out).toContain("rules/x.mdx:5:52");
    expect(out).toContain("search_term_string");
    expect(out).toContain("hint:");
  });
});
