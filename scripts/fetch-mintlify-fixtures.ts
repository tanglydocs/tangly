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
  // Large real-world configs — breadth across themes + nested nav shapes.
  { name: "dub", url: "https://raw.githubusercontent.com/dubinc/docs/main/docs.json" },
  { name: "mem0", url: "https://raw.githubusercontent.com/mem0ai/mem0/main/docs/docs.json" },
  // `maple` theme + deeply nested tabs/groups (exercises optional group.pages).
  {
    name: "trigger",
    url: "https://raw.githubusercontent.com/triggerdotdev/trigger.dev/main/docs/docs.json",
  },
  { name: "upstash", url: "https://raw.githubusercontent.com/upstash/docs/main/docs.json" },
  {
    name: "helicone",
    url: "https://raw.githubusercontent.com/Helicone/helicone/main/docs/docs.json",
  },
  // 180KB config — `metadata.timestamp` boolean, broad API/contextual usage.
  { name: "portkey", url: "https://raw.githubusercontent.com/Portkey-AI/docs-core/main/docs.json" },
  // Broader corpus from GitHub code search — diverse themes + real-world shapes.
  // Two are regression anchors for compat gaps they exposed:
  //   bun        → navbar.links[].primary
  //   definitive → api.auth.default
  { name: "bun", url: "https://raw.githubusercontent.com/oven-sh/bun/main/docs/docs.json" },
  { name: "definitive", url: "https://raw.githubusercontent.com/DefinitiveCo/docs/main/docs.json" },
  { name: "ngrok", url: "https://raw.githubusercontent.com/ngrok/ngrok-docs/main/docs.json" },
  {
    name: "cobo",
    url: "https://raw.githubusercontent.com/CoboGlobal/developer-site/master/docs.json",
  },
  {
    name: "hyperswitch",
    url: "https://raw.githubusercontent.com/juspay/hyperswitch/main/api-reference/docs.json",
  },
  // almond theme, OpenAPI-heavy (~15 specs).
  { name: "liara", url: "https://raw.githubusercontent.com/liara-cloud/openapi/main/docs.json" },
  {
    name: "blueprint",
    url: "https://raw.githubusercontent.com/Blueprint-Finance/docs/main/docs.json",
  }, // luma theme
  { name: "phiki", url: "https://raw.githubusercontent.com/phikiphp/phiki/2.x/docs/docs.json" }, // willow theme
  {
    name: "argus",
    url: "https://raw.githubusercontent.com/Argus-Labs/world-engine/main/docs/docs.json",
  }, // maple theme
  {
    name: "pylon",
    url: "https://raw.githubusercontent.com/pylonsync/pylon/main/apps/docs/docs.json",
  },
  {
    name: "tracecat",
    url: "https://raw.githubusercontent.com/TracecatHQ/tracecat/main/docs/docs.json",
  }, // aspen theme
  { name: "heyaikeedo", url: "https://raw.githubusercontent.com/heyaikeedo/docs/main/docs.json" },
  {
    name: "neutron",
    url: "https://raw.githubusercontent.com/neutron-org/neutron-docs/main/docs.json",
  },
  {
    name: "abstract",
    url: "https://raw.githubusercontent.com/Abstract-Foundation/abstract-docs/main/docs.json",
  },
  { name: "solvapay", url: "https://raw.githubusercontent.com/solvapay/docs/main/docs.json" },
  { name: "itemsadder", url: "https://raw.githubusercontent.com/ItemsAdder/wiki/main/docs.json" },
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
