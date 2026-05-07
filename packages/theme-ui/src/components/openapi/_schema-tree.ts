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

export function renderSchemaTree(schema: unknown): Field[] {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, unknown>;
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
