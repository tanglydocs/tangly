import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { applyTemplate, getTemplate, listTemplates } from "./templates.js";

// Templates resolve relative to the compiled bundle at `dist/cli/templates.js`,
// looking for `dist/templates/`. Vitest runs against `src/`, so we synthesize a
// fixture tree at `src/templates/` for the duration of the test.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = resolve(HERE, "..", "templates");
const FIXTURE_NAME = "vitest-fixture";

beforeAll(async () => {
  await mkdir(join(FIXTURE_ROOT, FIXTURE_NAME, "sub"), { recursive: true });
  writeFileSync(
    join(FIXTURE_ROOT, FIXTURE_NAME, "docs.json"),
    JSON.stringify({ name: "{{name}}", theme: "tang" }),
    "utf8",
  );
  writeFileSync(
    join(FIXTURE_ROOT, FIXTURE_NAME, "sub", "page.mdx"),
    "# {{name}}\nstatic body\n",
    "utf8",
  );
  writeFileSync(
    join(FIXTURE_ROOT, "index.json"),
    JSON.stringify([
      {
        name: FIXTURE_NAME,
        label: "Vitest Fixture",
        description: "test only",
        files: ["docs.json", "sub/page.mdx"],
      },
    ]),
    "utf8",
  );
});

afterAll(async () => {
  await rm(FIXTURE_ROOT, { recursive: true, force: true });
});

test("listTemplates exposes the fixture", () => {
  const all = listTemplates();
  const names = all.map((t) => t.name);
  expect(names).toContain(FIXTURE_NAME);
  expect(getTemplate(FIXTURE_NAME)?.label).toBe("Vitest Fixture");
});

test("applyTemplate writes files and substitutes {{name}}", async () => {
  const target = mkdtempSync(join(tmpdir(), "tangly-tpl-"));
  const result = await applyTemplate({
    template: FIXTURE_NAME,
    dir: target,
    name: "Acme Docs",
  });

  expect(result.written.toSorted()).toEqual(["docs.json", "sub/page.mdx"]);
  expect(result.skipped).toEqual([]);
  expect(readdirSync(target).toSorted()).toEqual(["docs.json", "sub"]);

  const config = JSON.parse(readFileSync(join(target, "docs.json"), "utf8"));
  expect(config.name).toBe("Acme Docs");

  const page = readFileSync(join(target, "sub", "page.mdx"), "utf8");
  expect(page).toContain("# Acme Docs");

  await rm(target, { recursive: true, force: true });
});

test("applyTemplate refuses to overwrite existing files", async () => {
  const target = mkdtempSync(join(tmpdir(), "tangly-tpl-"));
  writeFileSync(join(target, "docs.json"), '{"keep": true}', "utf8");

  const result = await applyTemplate({
    template: FIXTURE_NAME,
    dir: target,
    name: "Acme",
  });

  expect(result.skipped).toContain("docs.json");
  expect(result.written).toContain("sub/page.mdx");
  expect(JSON.parse(readFileSync(join(target, "docs.json"), "utf8"))).toEqual({ keep: true });

  await rm(target, { recursive: true, force: true });
});

test("applyTemplate throws on unknown template", async () => {
  await expect(
    applyTemplate({ template: "does-not-exist", dir: tmpdir(), name: "x" }),
  ).rejects.toThrow(/Unknown template/);
});
