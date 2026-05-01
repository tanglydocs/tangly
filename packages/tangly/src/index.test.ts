import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { VERSION } from "./index.js";

test("VERSION matches package.json", () => {
  const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  expect(VERSION).toBe(pkg.version);
});
