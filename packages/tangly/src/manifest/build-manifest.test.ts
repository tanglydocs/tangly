import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { buildManifest } from "./build-manifest.js";

const OPENNEM = resolve(import.meta.dirname, "../../../../examples/opennem");

describe("buildManifest — Opennem corpus", () => {
  if (!existsSync(`${OPENNEM}/docs.json`)) {
    test.skip("Opennem corpus not available", () => undefined);
    return;
  }

  test("builds without errors", async () => {
    const m = await buildManifest({ root: OPENNEM });
    expect(m.config.name).toBe("Open Electricity Documentation");
    expect(m.navigation.tabs.length).toBe(5);
    // every nav slug should be a known page or a warning
    expect(m.pages.size).toBeGreaterThan(0);
  });

  test("nav slugs match known Opennem structure", async () => {
    const m = await buildManifest({ root: OPENNEM });
    expect(m.pages.has("introduction")).toBe(true);
    expect(m.pages.has("guides/networks")).toBe(true);
    expect(m.pages.has("api-reference/overview")).toBe(true);
    expect(m.pages.has("sdk/typescript/overview")).toBe(true);
  });

  test("computes prev/next inside a tab", async () => {
    const m = await buildManifest({ root: OPENNEM });
    const networks = m.pages.get("guides/networks");
    expect(networks).toBeDefined();
    // networks is the first guide so prev should be community (last in Get Started)
    expect(networks?.prev?.slug).toBe("community");
    expect(networks?.next?.slug).toBe("guides/power");
  });

  test("orphans for files on disk not in nav", async () => {
    const m = await buildManifest({ root: OPENNEM });
    // We don't assert exact orphans but expect the array to exist
    expect(Array.isArray(m.orphans)).toBe(true);
  });

  test("pages carry tab metadata", async () => {
    const m = await buildManifest({ root: OPENNEM });
    const apiPage = m.pages.get("api-reference/overview");
    expect(apiPage?.tab?.title).toBe("API Reference");
  });
});
