import type { DocsJson } from "@tanglydocs/schema";
import type { Frontmatter } from "@tanglydocs/schema";
import { describe, expect, test } from "vitest";
import { resolveNavigation } from "./resolve-nav.js";

function resolve(navigation: unknown) {
  const config = { name: "T", navigation } as unknown as DocsJson;
  const diskPages = new Map<string, { frontmatter: Frontmatter | null }>();
  return resolveNavigation({ config, diskPages });
}

describe("resolveNavigation: anchors-as-nav", () => {
  test("promotes a top-level anchor's tabs to tabs and registers their pages", () => {
    const r = resolve({
      anchors: [
        {
          anchor: "Documentation",
          icon: "book-open",
          tabs: [
            { tab: "Welcome", groups: [{ group: "Start", pages: ["intro"] }] },
            { tab: "API", groups: [{ group: "Ref", pages: ["api/list"] }] },
          ],
        },
      ],
    });
    expect(r.navigation.tabs.map((t) => t.title)).toEqual(["Welcome", "API"]);
    expect(r.navSlugs).toEqual(expect.arrayContaining(["intro", "api/list"]));
  });

  test("an anchor holding groups directly becomes a tab named after the anchor", () => {
    const r = resolve({
      anchors: [{ anchor: "Guides", icon: "book", groups: [{ group: "G", pages: ["guides/a"] }] }],
    });
    expect(r.navigation.tabs.map((t) => t.title)).toContain("Guides");
    expect(r.navSlugs).toContain("guides/a");
  });

  test("href-only top-level anchors become anchor links, not tabs", () => {
    const r = resolve({
      anchors: [{ anchor: "Community", href: "https://example.com", icon: "users" }],
    });
    expect(r.navigation.tabs).toHaveLength(0);
    expect(r.navigation.anchors.map((a) => a.href)).toContain("https://example.com");
  });
});
