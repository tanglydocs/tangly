import * as lucide from "lucide";
import { describe, expect, test } from "vitest";
import { FA_TO_LUCIDE } from "./fa-to-lucide.js";

const lucideExports = lucide as unknown as Record<string, unknown>;

// Mirrors Icon.astro's auto-resolution: kebab/space -> PascalCase.
function toPascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ""))
    .join("");
}

describe("FA_TO_LUCIDE", () => {
  test("every mapped target is a real Lucide export", () => {
    const missing = Object.entries(FA_TO_LUCIDE).filter(([, lu]) => !lucideExports[lu]);
    expect(missing).toEqual([]);
  });

  test("keys are lowercase (resolution lowercases the input)", () => {
    const upper = Object.keys(FA_TO_LUCIDE).filter((k) => k !== k.toLowerCase());
    expect(upper).toEqual([]);
  });

  test("no redundant entries that the PascalCase fallback already handles", () => {
    // An entry whose key PascalCases to the same Lucide name is dead weight.
    const redundant = Object.entries(FA_TO_LUCIDE).filter(([fa, lu]) => toPascal(fa) === lu);
    expect(redundant).toEqual([]);
  });

  test("covers the FA v6 renames and Mintlify aliases docs rely on", () => {
    const cases: Record<string, string> = {
      "magnifying-glass": "Search",
      gear: "Settings",
      xmark: "X",
      "book-open-cover": "BookOpen",
      "pen-to-square": "SquarePen",
      "arrow-up-right-from-square": "ExternalLink",
      "angle-down": "ChevronDown",
      "trash-can": "Trash2",
      "floppy-disk": "Save",
      "circle-info": "Info",
    };
    for (const [fa, lu] of Object.entries(cases)) {
      expect(FA_TO_LUCIDE[fa], fa).toBe(lu);
      expect(lucideExports[lu], lu).toBeTruthy();
    }
  });
});
