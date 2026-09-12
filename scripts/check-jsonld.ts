/**
 * Validate the JSON-LD in a built site.
 *
 * Walks every `.html` under a dist directory and, for each one, asserts:
 *   - exactly one `<script type="application/ld+json">`
 *   - it parses, and is a single `@graph`
 *   - every `@id` is absolute
 *   - no `@id` is declared twice
 *   - every `@id` *referenced* in the graph is declared in that same graph
 *   - the site-level Organization / WebSite nodes are byte-identical across
 *     every page (one entity for the site, not one per URL)
 *
 * Usage: bun scripts/check-jsonld.ts <dist-dir> [--print <n>]
 *
 * `--print n` dumps the graph of the first n pages, for eyeballing against
 * the Schema.org validator.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { danglingRefs, type JsonLdGraph } from "../packages/schema/src/json-ld.js";

const args = process.argv.slice(2);
const distDir = args.find((a) => !a.startsWith("--")) ?? "docs/dist";
const printIdx = args.indexOf("--print");
const printCount = printIdx >= 0 ? Number(args[printIdx + 1] ?? 0) : 0;

const SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const stack = [dir]; stack.length > 0; ) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(entry.parentPath, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".html")) out.push(full);
    }
  }
  return out.toSorted();
}

const errors: string[] = [];
const files = htmlFiles(distDir);
if (files.length === 0) {
  console.error(`no .html files under ${distDir}`);
  process.exit(1);
}

let siteNodes: string | null = null;
let siteNodesFrom = "";
let printed = 0;

for (const file of files) {
  const rel = relative(distDir, file);
  const html = readFileSync(file, "utf8");
  const blocks = [...html.matchAll(SCRIPT_RE)].map((m) => m[1]);

  if (blocks.length !== 1) {
    errors.push(`${rel}: expected exactly 1 ld+json block, found ${blocks.length}`);
    continue;
  }

  let graph: JsonLdGraph;
  try {
    graph = JSON.parse(blocks[0]!) as JsonLdGraph;
  } catch (e) {
    errors.push(`${rel}: ld+json does not parse — ${(e as Error).message}`);
    continue;
  }

  if (!Array.isArray(graph["@graph"])) {
    errors.push(`${rel}: no @graph array`);
    continue;
  }

  const ids = graph["@graph"].map((n) => n["@id"]);
  for (const id of ids) {
    if (!/^https?:\/\//.test(id)) errors.push(`${rel}: @id is not absolute — ${id}`);
  }
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) errors.push(`${rel}: @id declared twice — ${dupes.join(", ")}`);

  const dangling = danglingRefs(graph);
  if (dangling.length > 0) {
    errors.push(`${rel}: @id referenced but never declared — ${dangling.join(", ")}`);
  }

  // The Organization + WebSite pair must be identical on every page.
  const site = JSON.stringify(
    graph["@graph"].filter((n) => n["@type"] === "Organization" || n["@type"] === "WebSite"),
  );
  if (siteNodes === null) {
    siteNodes = site;
    siteNodesFrom = rel;
  } else if (site !== siteNodes) {
    errors.push(`${rel}: Organization/WebSite differ from ${siteNodesFrom}`);
  }

  if (printed < printCount) {
    printed += 1;
    console.log(`\n=== ${rel} ===`);
    console.log(JSON.stringify(graph, null, 2));
  }
}

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} JSON-LD problem(s) across ${files.length} page(s):`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `\n✓ JSON-LD valid on ${files.length} page(s): one graph each, all @id absolute, ` +
    `no duplicate declarations, no dangling references, site nodes identical throughout.`,
);
