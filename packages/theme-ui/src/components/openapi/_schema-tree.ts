/**
 * Flatten a JSON Schema object into a list of top-level fields. The raw
 * schema for each field is passed through so callers can use
 * `describeSchema()` for type/enum/default formatting.
 */

interface Field {
  name: string;
  required: boolean;
  schema: Record<string, unknown>;
}

/**
 * Resolve a schema down to the object that actually carries `properties`.
 * Handles the wrappers FastAPI/Pydantic specs lean on:
 *   - `anyOf`/`oneOf` — pick the first non-null branch with properties
 *     (so `anyOf: [Model, null]` request bodies expand to Model's fields)
 *   - `allOf` — merge properties across all branches
 * Already-dereferenced `$ref`s are inlined upstream (see `_spec-loader.ts`).
 */
export function unwrapSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const s = schema as Record<string, unknown>;
  if (s.properties) return s;

  if (Array.isArray(s.allOf)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const v of s.allOf as unknown[]) {
      const u = unwrapSchema(v);
      Object.assign(properties, (u.properties as Record<string, unknown>) ?? {});
      if (Array.isArray(u.required)) required.push(...(u.required as string[]));
    }
    if (Object.keys(properties).length > 0) {
      return { type: "object", properties, required };
    }
  }

  const variants = (s.anyOf ?? s.oneOf) as unknown[] | undefined;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      if (!v || typeof v !== "object") continue;
      if ((v as Record<string, unknown>).type === "null") continue;
      const u = unwrapSchema(v);
      if (u.properties) return u;
    }
  }

  return s;
}

export function renderSchemaTree(schema: unknown): Field[] {
  const s = unwrapSchema(schema);
  const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);
  const out: Field[] = [];
  for (const [name, p] of Object.entries(props)) {
    out.push({
      name,
      required: required.has(name),
      schema: p,
    });
  }
  return out;
}
