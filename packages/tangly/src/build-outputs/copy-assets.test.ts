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

  test("hard-rejects any path in Astro's _astro/ namespace", async () => {
    mkdirSync(`${TMP}/src/_astro`, { recursive: true });
    writeFileSync(`${TMP}/src/_astro/evil.js`, "/* override */");
    const m = fakeManifest(`${TMP}/src`);
    // Empty astroEmitted — protection applies to the whole namespace,
    // not just paths Astro happened to emit this run.
    await expect(
      copyStaticAssets({ manifest: m, outDir: `${TMP}/out`, astroEmitted: new Set() }),
    ).rejects.toThrow(/Astro's reserved namespace/);
  });

  test("warns + allows user file when colliding with non-_astro emitted output", async () => {
    writeFileSync(`${TMP}/src/robots.txt`, "User-agent: BadBot\n");
    const m = fakeManifest(`${TMP}/src`);
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => warns.push(msg);
    try {
      await copyStaticAssets({
        manifest: m,
        outDir: `${TMP}/out`,
        astroEmitted: new Set(["robots.txt"]),
      });
    } finally {
      console.warn = orig;
    }
    expect(existsSync(join(TMP, "out/robots.txt"))).toBe(true);
    expect(warns.some((w) => w.includes("overwrites a generated output"))).toBe(true);
  });

  test("baseline excludes .gitignore + .tanglyignore from passthrough", async () => {
    writeFileSync(`${TMP}/src/.gitignore`, "private/\n");
    writeFileSync(`${TMP}/src/.tanglyignore`, "scripts/\n");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    expect(existsSync(join(TMP, "out/.gitignore"))).toBe(false);
    expect(existsSync(join(TMP, "out/.tanglyignore"))).toBe(false);
  });

  test("baseline cannot be re-included via user negation patterns", async () => {
    // Adversarial .tanglyignore: try to un-ignore baseline-excluded files.
    writeFileSync(
      `${TMP}/src/.tanglyignore`,
      ["!.gitignore", "!.tanglyignore", "!docs.json", "!node_modules/", "!.env"].join("\n") + "\n",
    );
    writeFileSync(`${TMP}/src/.gitignore`, "private/\n");
    writeFileSync(`${TMP}/src/docs.json`, "{}");
    writeFileSync(`${TMP}/src/.env`, "SECRET=1");
    mkdirSync(`${TMP}/src/node_modules/foo`, { recursive: true });
    writeFileSync(`${TMP}/src/node_modules/foo/index.js`, "");
    const m = fakeManifest(`${TMP}/src`);
    await copyStaticAssets({ manifest: m, outDir: `${TMP}/out` });
    // None of these should leak — baseline is non-overridable.
    expect(existsSync(join(TMP, "out/.gitignore"))).toBe(false);
    expect(existsSync(join(TMP, "out/.tanglyignore"))).toBe(false);
    expect(existsSync(join(TMP, "out/docs.json"))).toBe(false);
    expect(existsSync(join(TMP, "out/.env"))).toBe(false);
    expect(existsSync(join(TMP, "out/node_modules"))).toBe(false);
  });
});
