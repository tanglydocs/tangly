#!/usr/bin/env bun
/**
 * Vendor real-world Mintlify `docs.json` configs as parser fixtures.
 *
 * These guard the promise that Tangly renders Mintlify projects unmodified:
 * the test in `packages/schema/src/mintlify-fixtures.test.ts` parses each one
 * through Tangly's schema and tells us the moment Mintlify ships a field shape
 * we don't yet accept. First-party Mintlify repos (`docs`, `starter`) track the
 * latest schema; the third-party ones add real-world breadth.
 *
 * Refresh (run periodically / when chasing "mintlify latest"):
 *   bun run scripts/fetch-mintlify-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(import.meta.dirname, "..", "packages/schema/fixtures/mintlify");

const SOURCES = [
  // Mintlify's own docs — they dogfood every new feature here first.
  { name: "mintlify-docs", url: "https://raw.githubusercontent.com/mintlify/docs/main/docs.json" },
  // Mintlify's canonical starter template (the `mint init` shape).
  {
    name: "mintlify-starter",
    url: "https://raw.githubusercontent.com/mintlify/starter/main/docs.json",
  },
  // Large real-world configs.
  { name: "dub", url: "https://raw.githubusercontent.com/dubinc/docs/main/docs.json" },
  { name: "mem0", url: "https://raw.githubusercontent.com/mem0ai/mem0/main/docs/docs.json" },
] as const;

mkdirSync(outDir, { recursive: true });

const fetched = await Promise.all(
  SOURCES.map(async ({ name, url }) => {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      process.stderr.write(`✗ ${name}: HTTP ${res.status} ${url}\n`);
      process.exit(1);
    }
    const text = await res.text();
    // Fail loud if a source ever stops serving valid JSON.
    const parsed = JSON.parse(text) as unknown;
    return { name, url, parsed, bytes: text.length };
  }),
);

const provenance: Array<{ name: string; url: string }> = [];
for (const { name, url, parsed, bytes } of fetched) {
  writeFileSync(resolve(outDir, `${name}.json`), `${JSON.stringify(parsed, null, 2)}\n`);
  provenance.push({ name, url });
  process.stdout.write(`✓ ${name} (${bytes}b) ← ${url}\n`);
}

writeFileSync(resolve(outDir, "sources.json"), `${JSON.stringify(provenance, null, 2)}\n`);
process.stdout.write(`\nVendored ${provenance.length} fixtures → ${outDir}\n`);
