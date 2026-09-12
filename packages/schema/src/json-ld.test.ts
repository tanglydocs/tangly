import { describe, expect, test } from "vitest";
import {
  buildJsonLd,
  type BuildJsonLdInput,
  danglingRefs,
  declaredIds,
  type JsonLdGraph,
  type JsonLdNode,
  resolveOrganization,
  serializeJsonLd,
} from "./json-ld.js";

const ROOT = "https://docs.example.com";

/** Absolutize the way the head fragment does: root-relative against origin. */
const absolutize = (path: string): string =>
  path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${ROOT}${path.startsWith("/") ? path : `/${path}`}`;

function org(
  overrides: Parameters<typeof resolveOrganization>[0] extends infer _
    ? Partial<Parameters<typeof resolveOrganization>[0]>
    : never = {},
) {
  return resolveOrganization({
    siteName: "Example",
    siteRoot: ROOT,
    logo: "/images/logo.png",
    absolutize,
    ...overrides,
  });
}

// `site` and `page` replace the defaults outright rather than merging, so a
// test that omits a field (no search, no description) really gets it omitted.
function input(overrides: Partial<BuildJsonLdInput> = {}): BuildJsonLdInput {
  return {
    site: overrides.site ?? {
      siteRoot: ROOT,
      name: "Example",
      description: "Example docs.",
      locale: "en",
      organization: org(),
      searchUrlTemplate: `${ROOT}/?q={search_term_string}`,
    },
    page: overrides.page ?? {
      url: `${ROOT}/guides/install`,
      title: "Install",
      description: "How to install.",
    },
    navPath: overrides.navPath ?? [{ name: "Guides", url: `${ROOT}/guides` }],
    dates: overrides.dates ?? {},
  };
}

function node(graph: JsonLdGraph, type: string): JsonLdNode | undefined {
  return graph["@graph"].find((n) => n["@type"] === type);
}

describe("resolveOrganization", () => {
  test("defaults name, url, logo and sameAs from the site", () => {
    const resolved = resolveOrganization({
      siteName: "Example",
      siteRoot: ROOT,
      sameAs: ["https://github.com/example"],
      logo: "/images/logo.png",
      absolutize,
    });
    expect(resolved).toEqual({
      name: "Example",
      url: ROOT,
      logo: `${ROOT}/images/logo.png`,
      sameAs: ["https://github.com/example"],
    });
  });

  test("seo.organization overrides every default, sameAs included", () => {
    const resolved = resolveOrganization({
      siteName: "Example",
      siteRoot: ROOT,
      sameAs: ["https://github.com/example"],
      logo: "/images/logo.png",
      organization: {
        name: "Example Inc",
        url: "https://example.com/",
        logo: "https://cdn.example.com/mark.png",
        sameAs: ["https://x.com/example"],
      },
      absolutize,
    });
    expect(resolved).toEqual({
      name: "Example Inc",
      url: "https://example.com",
      logo: "https://cdn.example.com/mark.png",
      // Overrides rather than merges with the root list.
      sameAs: ["https://x.com/example"],
    });
  });

  test("omits logo entirely when the project has none", () => {
    const resolved = resolveOrganization({ siteName: "Example", siteRoot: ROOT, absolutize });
    expect(resolved.logo).toBeUndefined();
    expect(resolved.sameAs).toBeUndefined();
  });

  test("deduplicates and drops empty sameAs entries", () => {
    const resolved = resolveOrganization({
      siteName: "Example",
      siteRoot: ROOT,
      sameAs: ["https://x.com/a", "https://x.com/a", "  "],
      absolutize,
    });
    expect(resolved.sameAs).toEqual(["https://x.com/a"]);
  });
});

describe("buildJsonLd — defaults", () => {
  const graph = buildJsonLd(input())!;

  test("emits one node per type with no duplicates", () => {
    const types = graph["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "BreadcrumbList", "WebPage", "TechArticle"]);
    expect(new Set(declaredIds(graph)).size).toBe(declaredIds(graph).length);
  });

  test("every referenced @id resolves inside the same graph", () => {
    expect(danglingRefs(graph)).toEqual([]);
  });

  test("Organization and WebSite ids are site-scoped, not page-scoped", () => {
    expect(node(graph, "Organization")?.["@id"]).toBe(`${ROOT}#organization`);
    expect(node(graph, "WebSite")?.["@id"]).toBe(`${ROOT}/#website`);
  });

  test("the same site nodes appear on a different page", () => {
    const other = buildJsonLd(input({ page: { url: `${ROOT}/other`, title: "Other" } }))!;
    expect(node(other, "Organization")).toEqual(node(graph, "Organization"));
    expect(node(other, "WebSite")).toEqual(node(graph, "WebSite"));
  });

  test("page nodes reference the site nodes rather than redeclaring them", () => {
    expect(node(graph, "WebPage")?.isPartOf).toEqual({ "@id": `${ROOT}/#website` });
    expect(node(graph, "TechArticle")?.publisher).toEqual({ "@id": `${ROOT}#organization` });
    expect(node(graph, "TechArticle")?.about).toEqual({ "@id": `${ROOT}#organization` });
    expect(node(graph, "TechArticle")?.mainEntityOfPage).toEqual({
      "@id": `${ROOT}/guides/install`,
    });
  });

  test("logo is an ImageObject with its own @id", () => {
    expect(node(graph, "Organization")?.logo).toEqual({
      "@type": "ImageObject",
      "@id": `${ROOT}#logo`,
      url: `${ROOT}/images/logo.png`,
    });
  });

  test("with no frontmatter author the organization is the author", () => {
    expect(node(graph, "TechArticle")?.author).toEqual({ "@id": `${ROOT}#organization` });
    expect(node(graph, "Person")).toBeUndefined();
  });

  test("WebSite carries a SearchAction when the site has search", () => {
    expect(node(graph, "WebSite")?.potentialAction).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${ROOT}/?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    });
  });

  test("no SearchAction when the site has no search", () => {
    const noSearch = buildJsonLd(
      input({
        site: {
          siteRoot: ROOT,
          name: "Example",
          locale: "en",
          organization: org(),
        },
      }),
    )!;
    expect(node(noSearch, "WebSite")?.potentialAction).toBeUndefined();
  });

  test("inLanguage follows the site locale", () => {
    const fr = buildJsonLd(
      input({
        site: { siteRoot: ROOT, name: "Example", locale: "fr-CA", organization: org() },
      }),
    )!;
    expect(node(fr, "WebSite")?.inLanguage).toBe("fr-CA");
    expect(node(fr, "WebPage")?.inLanguage).toBe("fr-CA");
    expect(node(fr, "TechArticle")?.inLanguage).toBe("fr-CA");
  });
});

describe("buildJsonLd — breadcrumbs", () => {
  test("Home is first, the page is last, positions are contiguous", () => {
    const graph = buildJsonLd(
      input({
        navPath: [
          { name: "Guides", url: `${ROOT}/guides` },
          { name: "Authoring", url: `${ROOT}/guides/authoring` },
        ],
      }),
    )!;
    expect(node(graph, "BreadcrumbList")?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${ROOT}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${ROOT}/guides` },
      {
        "@type": "ListItem",
        position: 3,
        name: "Authoring",
        item: `${ROOT}/guides/authoring`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Install",
        item: `${ROOT}/guides/install`,
      },
    ]);
  });

  test("a grouping header with no page of its own is dropped, not left item-less", () => {
    const graph = buildJsonLd(
      input({ navPath: [{ name: "Guides" }, { name: "Authoring", url: `${ROOT}/guides/a` }] }),
    )!;
    const items = node(graph, "BreadcrumbList")?.itemListElement as { name: string }[];
    expect(items.map((i) => i.name)).toEqual(["Home", "Authoring", "Install"]);
    expect(items.every((i) => "item" in i)).toBe(true);
  });

  test("the home page does not appear twice", () => {
    const graph = buildJsonLd(input({ page: { url: ROOT, title: "Example" }, navPath: [] }))!;
    expect(node(graph, "BreadcrumbList")?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${ROOT}/` },
    ]);
  });

  test("the breadcrumb is referenced by the page and declared once", () => {
    const graph = buildJsonLd(input())!;
    expect(node(graph, "WebPage")?.breadcrumb).toEqual({
      "@id": `${ROOT}/guides/install#breadcrumb`,
    });
    expect(danglingRefs(graph)).toEqual([]);
  });
});

describe("buildJsonLd — dates", () => {
  test("emits both dates on WebPage and the article when present", () => {
    const graph = buildJsonLd(
      input({ dates: { published: "2026-01-02T03:04:05Z", modified: "2026-06-07T08:09:10Z" } }),
    )!;
    expect(node(graph, "WebPage")?.datePublished).toBe("2026-01-02T03:04:05Z");
    expect(node(graph, "WebPage")?.dateModified).toBe("2026-06-07T08:09:10Z");
    expect(node(graph, "TechArticle")?.datePublished).toBe("2026-01-02T03:04:05Z");
    expect(node(graph, "TechArticle")?.dateModified).toBe("2026-06-07T08:09:10Z");
  });

  test("omits the keys entirely when there are no dates (never a build stamp)", () => {
    const graph = buildJsonLd(input({ dates: {} }))!;
    for (const type of ["WebPage", "TechArticle"]) {
      expect(node(graph, type)).not.toHaveProperty("datePublished");
      expect(node(graph, type)).not.toHaveProperty("dateModified");
    }
  });

  test("a modified date with no published date still lands", () => {
    const graph = buildJsonLd(input({ dates: { modified: "2026-06-07T08:09:10Z" } }))!;
    expect(node(graph, "WebPage")?.dateModified).toBe("2026-06-07T08:09:10Z");
    expect(node(graph, "WebPage")).not.toHaveProperty("datePublished");
  });
});

describe("buildJsonLd — page overrides", () => {
  test("schemaType overrides the article type", () => {
    const graph = buildJsonLd(
      input({ page: { url: `${ROOT}/x`, title: "X", schemaType: "HowTo" } }),
    )!;
    expect(node(graph, "HowTo")).toBeDefined();
    expect(node(graph, "TechArticle")).toBeUndefined();
  });

  test("a blog or changelog nav group makes the page an Article", () => {
    for (const name of ["Blog", "changelog", "Release notes"]) {
      const graph = buildJsonLd(input({ navPath: [{ name, url: `${ROOT}/b` }] }))!;
      expect(node(graph, "Article"), name).toBeDefined();
      expect(node(graph, "TechArticle"), name).toBeUndefined();
    }
  });

  test("a string author becomes a Person node referenced by the article", () => {
    const graph = buildJsonLd(
      input({ page: { url: `${ROOT}/x`, title: "X", author: "Ada Lovelace" } }),
    )!;
    const person = node(graph, "Person")!;
    expect(person["@id"]).toBe(`${ROOT}/#person-ada-lovelace`);
    expect(person.name).toBe("Ada Lovelace");
    expect(node(graph, "TechArticle")?.author).toEqual({ "@id": person["@id"] });
    expect(danglingRefs(graph)).toEqual([]);
  });

  test("an object author keys the Person off their own URL", () => {
    const graph = buildJsonLd(
      input({
        page: {
          url: `${ROOT}/x`,
          title: "X",
          author: { name: "Ada Lovelace", url: "https://ada.example/" },
        },
      }),
    )!;
    const person = node(graph, "Person")!;
    expect(person["@id"]).toBe("https://ada.example#person");
    expect(person.url).toBe("https://ada.example/");
    expect(danglingRefs(graph)).toEqual([]);
  });

  test("an empty author name falls back to the organization", () => {
    const graph = buildJsonLd(input({ page: { url: `${ROOT}/x`, title: "X", author: "  " } }))!;
    expect(node(graph, "Person")).toBeUndefined();
    expect(node(graph, "TechArticle")?.author).toEqual({ "@id": `${ROOT}#organization` });
  });

  test("a page image lands on the article", () => {
    const graph = buildJsonLd(
      input({ page: { url: `${ROOT}/x`, title: "X", image: `${ROOT}/og/x.png` } }),
    )!;
    expect(node(graph, "TechArticle")?.image).toBe(`${ROOT}/og/x.png`);
  });

  test("a page with no body is a plain WebPage with no article", () => {
    const graph = buildJsonLd(input({ page: { url: `${ROOT}/x`, title: "X", hasBody: false } }))!;
    expect(node(graph, "TechArticle")).toBeUndefined();
    expect(node(graph, "WebPage")).toBeDefined();
    expect(danglingRefs(graph)).toEqual([]);
  });
});

describe("buildJsonLd — opt out and preconditions", () => {
  test("returns null without a site root", () => {
    expect(
      buildJsonLd(
        input({ site: { siteRoot: "", name: "Example", locale: "en", organization: org() } }),
      ),
    ).toBeNull();
  });

  test("returns null without a page URL", () => {
    expect(buildJsonLd(input({ page: { url: "", title: "X" } }))).toBeNull();
  });
});

describe("serializeJsonLd", () => {
  test("escapes a closing script tag hidden in a page title", () => {
    const graph = buildJsonLd(
      input({ page: { url: `${ROOT}/x`, title: "</script><img src=x onerror=alert(1)>" } }),
    )!;
    const text = serializeJsonLd(graph);
    expect(text).not.toContain("</script");
    expect(text).toContain("<\\/script");
    // Still valid JSON, and the title survives intact after parsing.
    const parsed = JSON.parse(text) as JsonLdGraph;
    expect(node(parsed, "WebPage")?.name).toBe("</script><img src=x onerror=alert(1)>");
  });

  test("escapes a case-variant closing tag too", () => {
    const graph = buildJsonLd(input({ page: { url: `${ROOT}/x`, title: "a </SCRIPT> b" } }))!;
    expect(serializeJsonLd(graph)).not.toMatch(/<\/script/i);
  });

  test("minified by default, pretty on request", () => {
    const graph = buildJsonLd(input())!;
    expect(serializeJsonLd(graph)).not.toContain("\n");
    expect(serializeJsonLd(graph, { pretty: true })).toContain("\n");
  });
});

describe("danglingRefs", () => {
  test("reports a reference with no declaration", () => {
    const broken: JsonLdGraph = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "@id": `${ROOT}/x`, isPartOf: { "@id": `${ROOT}/#website` } },
      ],
    };
    expect(danglingRefs(broken)).toEqual([`${ROOT}/#website`]);
  });

  test("an inline node with its own @id is not treated as a reference", () => {
    const graph = buildJsonLd(input())!;
    // The logo ImageObject is nested and declares `#logo`, which is not a
    // separate graph node — it must not be reported as dangling.
    expect(danglingRefs(graph)).toEqual([]);
  });
});
