import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { safeParseDocsJson } from "./docs-json.js";

// Real-world Mintlify `docs.json` configs vendored by
// `scripts/fetch-mintlify-fixtures.ts` (Mintlify's own docs + large
// third-party sites). These keep Tangly honest about its core promise:
// rendering Mintlify projects unmodified. Refresh them when chasing
// "mintlify latest"; a new failure here means Mintlify shipped a shape we
// don't yet accept.
const fixturesDir = resolve(import.meta.dirname, "../fixtures/mintlify");
const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json") && f !== "sources.json");

type Issue = { code: string; path: PropertyKey[]; message: string; keys?: string[] };

function report(issues: Issue[]): string {
  return issues
    .map((i) => {
      const path = i.path.map(String).join(".") || "<root>";
      const keys = i.keys ? ` keys=${JSON.stringify(i.keys)}` : "";
      return `  [${i.code}] ${path}${keys} :: ${i.message}`;
    })
    .join("\n");
}

function nodeAt(root: unknown, path: PropertyKey[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node;
}

function hasRef(node: unknown): boolean {
  return typeof node === "object" && node !== null && "$ref" in node;
}

// Tangly doesn't resolve Mintlify's external `{ "$ref": "./file.json" }`
// indirection yet, so an issue is excused ONLY when it sits on (or directly
// under) a `$ref` node. Every other issue — unrecognized nested keys, bad
// enum values, type mismatches — stays blocking, even in a config that
// happens to use `$ref` elsewhere.
function isRefArtifact(root: unknown, path: PropertyKey[]): boolean {
  return hasRef(nodeAt(root, path)) || hasRef(nodeAt(root, path.slice(0, -1)));
}

describe("Mintlify compat fixtures", () => {
  test("vendored fixtures are present", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    // Parity guard: a real Mintlify config must parse, save for the documented
    // `$ref` gap. A new failure means Mintlify shipped a nested shape we must
    // alias (normalize.ts) or model (docs-json.ts). Note the top-level schema
    // is `.passthrough()`, so this catches *nested* gaps, not new top-level
    // keys (those are intentionally tolerated for forward-compat).
    test(`parses real Mintlify config: ${file}`, () => {
      const text = readFileSync(resolve(fixturesDir, file), "utf8");
      const parsed = JSON.parse(text);
      const result = safeParseDocsJson(parsed);
      const issues = (result.success ? [] : result.error.issues) as unknown as Issue[];

      const blocking = issues.filter((i) => !isRefArtifact(parsed, i.path));
      expect(blocking, `Blocking parse issues in ${file}:\n${report(blocking)}`).toEqual([]);
    });
  }
});
