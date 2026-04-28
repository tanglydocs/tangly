import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateDocsJsonSchema } from "../src/json-schema.js";

const out = resolve(import.meta.dirname, "../dist/docs.json");
mkdirSync(dirname(out), { recursive: true });
const schema = generateDocsJsonSchema();
writeFileSync(out, JSON.stringify(schema, null, 2), "utf8");
console.log(`emitted ${out}`);
