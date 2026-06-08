import { readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";

const MAX_DEPTH = 20;

/**
 * Resolve Mintlify-style JSON `$ref` references in a parsed `docs.json`.
 *
 * Mintlify splits large configs across files: `{ "$ref": "./redirects.json" }`
 * or a language entry `{ "$ref": "./fr.json" }`. A node shaped
 * `{ "$ref": "<path>" }` (optionally with a `#/json/pointer` fragment) is
 * replaced by the referenced file's contents, resolved relative to the file
 * that contains the ref. Refs inside a referenced file resolve relative to
 * *that* file's directory. Cycles and runaway nesting throw.
 *
 * Pure `#/...` internal pointers (no path) are left untouched — those aren't a
 * docs.json convention and belong to OpenAPI specs handled elsewhere.
 */
export function resolveJsonRefs(value: unknown, baseDir: string): unknown {
  return walk(value, baseDir, 0, new Set<string>());
}

function walk(value: unknown, baseDir: string, depth: number, stack: Set<string>): unknown {
  if (depth > MAX_DEPTH) {
    throw new Error("docs.json $ref nesting too deep (possible cycle).");
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, baseDir, depth, stack));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const ref = obj.$ref;
    if (typeof ref === "string") {
      const [pathPart, pointer] = ref.split("#");
      if (pathPart) {
        const abs = resolvePath(baseDir, pathPart);
        const key = `${abs}#${pointer ?? ""}`;
        if (stack.has(key)) throw new Error(`docs.json $ref cycle at "${ref}".`);
        let doc: unknown;
        try {
          doc = JSON.parse(readFileSync(abs, "utf8"));
        } catch (err) {
          throw new Error(`docs.json $ref "${ref}" could not be loaded: ${(err as Error).message}`);
        }
        const target = pointer ? resolvePointer(doc, pointer) : doc;
        const nextStack = new Set(stack);
        nextStack.add(key);
        // Nested refs in the referenced file resolve relative to its own dir.
        return walk(target, dirname(abs), depth + 1, nextStack);
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v, baseDir, depth, stack);
    return out;
  }
  return value;
}

function resolvePointer(doc: unknown, pointer: string): unknown {
  const parts = pointer
    .split("/")
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") {
      throw new Error(`docs.json $ref pointer "#${pointer}" did not resolve.`);
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  // A missing final segment leaves `cur` undefined; report it at the ref site
  // rather than inlining undefined and failing schema validation far away.
  if (cur === undefined) {
    throw new Error(`docs.json $ref pointer "#${pointer}" did not resolve.`);
  }
  return cur;
}
