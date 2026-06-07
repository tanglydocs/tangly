import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildManifest } from "../manifest/build-manifest.js";
import type { Manifest } from "../manifest/types.js";

// A group inside a tab may carry its own `openapi` spec (Mintlify feature,
// issue #6). The spec expands into endpoint pages nested under that group,
// alongside any hand-authored groups in the same tab.
const SPEC = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  tags: [{ name: "Birds" }, { name: "Feed" }],
  paths: {
    "/birds": {
      get: { tags: ["Birds"], summary: "List birds", responses: { "200": { description: "ok" } } },
      post: { tags: ["Birds"], summary: "Add bird", responses: { "201": { description: "ok" } } },
    },
    "/feed": {
      get: { tags: ["Feed"], summary: "List feed", responses: { "200": { description: "ok" } } },
    },
  },
};

const DOCS = {
  name: "Group OpenAPI",
  navigation: {
    tabs: [
      {
        tab: "API Reference",
        groups: [
          { group: "Overview", pages: ["index"] },
          // No `pages` — driven entirely by the spec.
          { group: "Endpoints", openapi: "openapi.json" },
        ],
      },
    ],
  },
};

let root: string;
let manifest: Manifest;

describe("group-level OpenAPI expansion", () => {
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "tangly-group-oas-"));
    writeFileSync(join(root, "docs.json"), JSON.stringify(DOCS));
    writeFileSync(join(root, "openapi.json"), JSON.stringify(SPEC));
    writeFileSync(join(root, "index.mdx"), "---\ntitle: Overview\n---\n\nHello.\n");
    manifest = await buildManifest({ root, configFile: "docs.json" });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  test("synthesizes one page per operation", () => {
    const endpointPages = [...manifest.pages.values()].filter((p) => p.frontmatter?.openapi);
    expect(endpointPages).toHaveLength(3);
  });

  test("nests endpoints under the group, split by tag, keeping the manual group", () => {
    const tab = manifest.navigation.tabs.find((t) => t.title === "API Reference");
    expect(tab).toBeDefined();
    const titles = tab?.sidebar.map((s) => s.title);
    expect(titles).toEqual(["Overview", "Endpoints"]);

    const endpoints = tab?.sidebar.find((s) => s.title === "Endpoints");
    const tagGroups = (endpoints?.children ?? []).map((c) => c.title).toSorted();
    expect(tagGroups).toEqual(["Birds", "Feed"]);
    const birds = endpoints?.children?.find((c) => c.title === "Birds");
    expect(birds?.children).toHaveLength(2); // GET + POST /birds
  });

  test("registers endpoint slugs as reachable in the tab", () => {
    const tab = manifest.navigation.tabs.find((t) => t.title === "API Reference");
    const endpointPages = [...manifest.pages.values()].filter((p) => p.frontmatter?.openapi);
    for (const p of endpointPages) {
      expect(tab?.pages).toContain(p.slug);
    }
  });
});
