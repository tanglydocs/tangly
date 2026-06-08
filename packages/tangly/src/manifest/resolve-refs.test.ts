import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveJsonRefs } from "./resolve-refs.js";

const TMP = "/tmp/tangly-resolve-refs-test";

describe("resolveJsonRefs", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  afterEach(() => rmSync(TMP, { recursive: true, force: true }));

  test("inlines a whole-file $ref relative to baseDir", () => {
    writeFileSync(`${TMP}/redirects.json`, JSON.stringify([{ source: "/a", destination: "/b" }]));
    const out = resolveJsonRefs({ redirects: { $ref: "./redirects.json" } }, TMP);
    expect(out).toEqual({ redirects: [{ source: "/a", destination: "/b" }] });
  });

  test("resolves $ref inside arrays, with nested refs relative to the ref's own dir", () => {
    mkdirSync(`${TMP}/sub`, { recursive: true });
    writeFileSync(`${TMP}/sub/inner.json`, JSON.stringify({ language: "fr" }));
    writeFileSync(`${TMP}/sub/fr.json`, JSON.stringify({ meta: { $ref: "./inner.json" } }));
    const out = resolveJsonRefs({ langs: [{ language: "en" }, { $ref: "./sub/fr.json" }] }, TMP);
    expect(out).toEqual({ langs: [{ language: "en" }, { meta: { language: "fr" } }] });
  });

  test("supports a #/pointer fragment", () => {
    writeFileSync(`${TMP}/data.json`, JSON.stringify({ items: { fr: { language: "fr" } } }));
    const out = resolveJsonRefs({ x: { $ref: "./data.json#/items/fr" } }, TMP);
    expect(out).toEqual({ x: { language: "fr" } });
  });

  test("throws a clear error on a cycle", () => {
    writeFileSync(`${TMP}/a.json`, JSON.stringify({ $ref: "./b.json" }));
    writeFileSync(`${TMP}/b.json`, JSON.stringify({ $ref: "./a.json" }));
    expect(() => resolveJsonRefs({ $ref: "./a.json" }, TMP)).toThrow(/cycle/);
  });
});
