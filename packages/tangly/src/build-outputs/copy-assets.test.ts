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

  test("copies all root files via copy-everything passthrough", async () => {
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/images/foo.png"))).toBe(true);
    expect(existsSync(join(TMP, "out/logo/logo.svg"))).toBe(true);
    expect(existsSync(join(TMP, "out/favicon.svg"))).toBe(true);
  });

  test("ships well-known deploy files at root (CNAME, _redirects, etc.)", async () => {
    writeFileSync(`${TMP}/src/CNAME`, "tangly.dev\n");
    writeFileSync(`${TMP}/src/_redirects`, "/old /new 301\n");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/CNAME"))).toBe(true);
    expect(existsSync(join(TMP, "out/_redirects"))).toBe(true);
  });

  test("baseline ignore excludes lockfiles, node_modules, *.md, docs.json", async () => {
    writeFileSync(`${TMP}/src/docs.json`, "{}");
    writeFileSync(`${TMP}/src/intro.mdx`, "# hi");
    writeFileSync(`${TMP}/src/bun.lock`, "");
    mkdirSync(`${TMP}/src/node_modules/foo`, { recursive: true });
    writeFileSync(`${TMP}/src/node_modules/foo/index.js`, "");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/docs.json"))).toBe(false);
    expect(existsSync(join(TMP, "out/intro.mdx"))).toBe(false);
    expect(existsSync(join(TMP, "out/bun.lock"))).toBe(false);
    expect(existsSync(join(TMP, "out/node_modules"))).toBe(false);
  });

  test(".tanglyignore extends the baseline (additive)", async () => {
    writeFileSync(`${TMP}/src/.tanglyignore`, "secret.txt\n");
    writeFileSync(`${TMP}/src/secret.txt`, "shh");
    writeFileSync(`${TMP}/src/public.txt`, "ok");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/secret.txt"))).toBe(false);
    expect(existsSync(join(TMP, "out/public.txt"))).toBe(true);
  });

  test(".gitignore is honoured (additive to baseline)", async () => {
    writeFileSync(`${TMP}/src/.gitignore`, "private/\n");
    mkdirSync(`${TMP}/src/private`, { recursive: true });
    writeFileSync(`${TMP}/src/private/keys.json`, "{}");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/private"))).toBe(false);
  });

  test("hard-protects Astro-emitted paths", async () => {
    mkdirSync(`${TMP}/src/_astro`, { recursive: true });
    writeFileSync(`${TMP}/src/_astro/evil.js`, "/* override */");
    const m = fakeManifest(`${TMP}/src`);
    await expect(
      copyStaticAssets({
        manifest: m,
        outDir: `${TMP}/out`,
        astroEmitted: new Set(["_astro/evil.js"]),
      }),
    ).rejects.toThrow(/Refusing to overwrite Astro-emitted asset/);
  });
});
