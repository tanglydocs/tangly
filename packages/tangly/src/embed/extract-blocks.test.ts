import { describe, expect, test } from "vitest";
import { extractBlocks } from "./extract-blocks.js";

describe("extractBlocks", () => {
  test("auto-slugs headings (h1-h6)", () => {
    const { blocks, order } = extractBlocks(`# Welcome\n\nIntro.\n\n## Rate limits\n\nDetails.\n`);
    expect(order).toEqual(["welcome", "rate-limits"]);
    expect(blocks.welcome).toMatch(/Intro\./);
    expect(blocks["rate-limits"]).toMatch(/Details\./);
    // h1 wraps h2 — "welcome" contains the rate-limits subsection.
    expect(blocks.welcome).toMatch(/Details\./);
  });

  test("explicit {#custom-id} on headings overrides auto slug", () => {
    const { blocks, order } = extractBlocks(`## My heading {#mine}\n\nx.\n\n## Other\n\ny.\n`);
    expect(order).toEqual(["mine", "other"]);
    expect(blocks.mine).toMatch(/x\./);
  });

  test("explicit {#custom-id} on a paragraph captures only that block", () => {
    const src = `## Section\n\nFirst para.\n\nSecond para. {#second}\n\nThird para.\n`;
    const { blocks, order } = extractBlocks(src);
    expect(order).toContain("section");
    expect(order).toContain("second");
    expect(blocks.second.trim()).toBe("Second para.");
  });

  test("section blocks close at the next sibling/parent heading", () => {
    const src = ["# A", "", "Para A.", "", "## A.1", "", "Sub.", "", "# B", "", "Para B."].join(
      "\n",
    );
    const { blocks } = extractBlocks(src);
    expect(blocks.a).toMatch(/Para A\./);
    expect(blocks.a).toMatch(/A\.1/);
    expect(blocks.a).not.toMatch(/Para B\./);
    expect(blocks.b).toMatch(/Para B\./);
  });

  test("ignores headings inside fenced code blocks", () => {
    const src = "## Real\n\nbody\n\n```\n# fake\n```\n\n## Also real\n";
    const { order } = extractBlocks(src);
    expect(order).toEqual(["real", "also-real"]);
  });
});
