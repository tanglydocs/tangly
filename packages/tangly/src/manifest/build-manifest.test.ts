import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildManifest } from "./build-manifest.js";

const TMP = "/tmp/tangly-build-manifest-test";

const SPEC = JSON.stringify({
  openapi: "3.1.0",
  paths: { "/things": { get: { summary: "List things" } } },
});

function setup(files: Record<string, string>): void {
  rmSync(TMP, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files)) {
    const path = `${TMP}/${rel}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

function apiOpenapi(config: unknown): string | string[] | undefined {
  return (config as { api?: { openapi?: string | string[] } }).api?.openapi;
}

describe("buildManifest OpenAPI auto-discovery", () => {
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  test("auto-discovers a root openapi.json when no spec is configured", async () => {
    setup({
      "docs.json": JSON.stringify({
        name: "T",
        navigation: { groups: [{ group: "G", pages: ["api/things"] }] },
      }),
      "openapi.json": SPEC,
      "api/things.mdx": '---\ntitle: Things\nopenapi: "GET /things"\n---\nbody\n',
    });
    const manifest = await buildManifest({ root: TMP });
    expect(apiOpenapi(manifest.config)).toBe("openapi.json");
  });

  test("does not override an explicitly configured api.openapi", async () => {
    setup({
      "docs.json": JSON.stringify({
        name: "T",
        api: { openapi: "https://example.com/spec.json" },
        navigation: { groups: [{ group: "G", pages: ["intro"] }] },
      }),
      "openapi.json": SPEC,
      "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    expect(apiOpenapi(manifest.config)).toBe("https://example.com/spec.json");
  });

  test("leaves api unset when there is no root spec", async () => {
    setup({
      "docs.json": JSON.stringify({
        name: "T",
        navigation: { groups: [{ group: "G", pages: ["intro"] }] },
      }),
      "intro.mdx": "---\ntitle: Intro\n---\nbody\n",
    });
    const manifest = await buildManifest({ root: TMP });
    expect(apiOpenapi(manifest.config)).toBeUndefined();
  });
});
