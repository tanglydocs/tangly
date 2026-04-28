import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Manifest } from "../manifest/types.js";
import { copyStaticAssets } from "./copy-assets.js";

const TMP = "/tmp/tangly-copy-assets-test";

function fakeManifest(root: string, favicon?: string): Manifest {
  return {
    config: {
      name: "Test",
      navigation: {},
      ...(favicon ? { favicon } : {}),
    },
    pages: new Map(),
    navigation: { tabs: [], anchors: [], rootSidebar: [] },
    orphans: [],
    warnings: [],
    root,
  };
}

describe("copyStaticAssets", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(`${TMP}/src/images`, { recursive: true });
    mkdirSync(`${TMP}/src/logo`, { recursive: true });
    mkdirSync(`${TMP}/out`, { recursive: true });
    writeFileSync(`${TMP}/src/images/foo.png`, "img");
    writeFileSync(`${TMP}/src/logo/logo.svg`, "<svg/>");
    writeFileSync(`${TMP}/src/favicon.svg`, "<svg/>");
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  test("copies known dirs", async () => {
    const m = fakeManifest(`${TMP}/src`);
    const out = await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(out.copied).toContain("images");
    expect(out.copied).toContain("logo");
    expect(existsSync(join(TMP, "out/images/foo.png"))).toBe(true);
    expect(existsSync(join(TMP, "out/logo/logo.svg"))).toBe(true);
  });

  test("copies favicon outside known dirs", async () => {
    const m = fakeManifest(`${TMP}/src`, "/favicon.svg");
    const out = await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/favicon.svg"))).toBe(true);
    expect(out.copied.some((c) => c.includes("favicon"))).toBe(true);
  });

  test("rejects favicon outside userRoot", async () => {
    const m = fakeManifest(`${TMP}/src`, "/../../etc/passwd");
    const out = await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(out.copied.some((c) => c.includes("favicon"))).toBe(false);
  });
});
