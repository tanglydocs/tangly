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

describe("resolveNavigation: default version/language variant", () => {
  test("renders the default language nav when the whole nav lives under languages", () => {
    const r = resolve({
      languages: [
        {
          language: "en",
          default: true,
          tabs: [{ tab: "Docs", groups: [{ group: "G", pages: ["intro"] }] }],
        },
        { language: "fr", tabs: [{ tab: "Docs", groups: [{ group: "G", pages: ["fr/intro"] }] }] },
      ],
    });
    expect(r.navigation.tabs.map((t) => t.title)).toEqual(["Docs"]);
    expect(r.navSlugs).toContain("intro");
    expect(r.navSlugs).not.toContain("fr/intro");
  });

  test("does not concatenate versions and languages defaults (prefers versions)", () => {
    const r = resolve({
      versions: [
        {
          version: "v2",
          default: true,
          tabs: [{ tab: "V2", groups: [{ group: "G", pages: ["v2/a"] }] }],
        },
      ],
      languages: [
        { language: "en", tabs: [{ tab: "EN", groups: [{ group: "G", pages: ["en/a"] }] }] },
      ],
    });
    expect(r.navigation.tabs.map((t) => t.title)).toEqual(["V2"]);
    expect(r.navSlugs).not.toContain("en/a");
  });

  test("skips variant defaults when a top-level container is present", () => {
    const r = resolve({
      tabs: [{ tab: "Top", groups: [{ group: "G", pages: ["top"] }] }],
      languages: [
        { language: "fr", tabs: [{ tab: "FR", groups: [{ group: "G", pages: ["fr/x"] }] }] },
      ],
    });
    expect(r.navigation.tabs.map((t) => t.title)).toEqual(["Top"]);
    expect(r.navSlugs).not.toContain("fr/x");
  });
});
