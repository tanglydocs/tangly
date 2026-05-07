/**
 * Build a JSON example payload from a JSON Schema (already dereferenced).
 *
 * Mintlify-style placeholder convention:
 *   - string         → `"<string>"` (or `"<email>"`, `"<uuid>"`, etc. when format is set)
 *   - string + format=date-time → `"2023-11-07T05:31:56Z"`
 *   - integer        → `123`
 *   - number         → `123.45`
 *   - boolean        → `true`
 *   - array          → `[]` (empty; one synthesized item if `defaults: "all"`)
 *   - object         → recurse; when `properties` is missing, return `{}`
 *   - enum           → first value
 *   - $circular      → `"<circular>"` (deref marker)
 *   - $unresolved    → `"<unresolved-ref>"`
 *   - schema example → use it directly when present
 *
 * The schema is assumed pre-dereffed; this function never resolves $refs.
 */

const ISO_NOW = "2023-11-07T05:31:56Z";

export function exampleFromSchema(schema: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (!schema || typeof schema !== "object") return null;
  const s = schema as Record<string, unknown>;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (s.$circular === true) return "<circular>";
  if (s.$unresolved === true) return "<unresolved-ref>";
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  if (Array.isArray(s.anyOf)) {
    // Skip null variant when picking the example
    const live = (s.anyOf as Record<string, unknown>[]).find((v) => v && v.type !== "null");
    return live ? exampleFromSchema(live, depth + 1) : null;
  }
  if (Array.isArray(s.oneOf)) {
    const live = (s.oneOf as Record<string, unknown>[]).find((v) => v && v.type !== "null");
    return live ? exampleFromSchema(live, depth + 1) : null;
  }
  switch (s.type) {
    case "string":
      return formatPlaceholder(s.format as string | undefined);
    case "integer":
      return 123;
    case "number":
      return 123.45;
    case "boolean":
      return true;
    case "null":
      return null;
    case "array":
      return []; // empty array is the safer default; users override via spec example
    case "object":
    default: {
      const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
      if (Object.keys(props).length === 0) return {};
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        out[k] = exampleFromSchema(v, depth + 1);
      }
      return out;
    }
  }
}

function formatPlaceholder(format?: string): string {
  switch (format) {
    case "date-time":
      return ISO_NOW;
    case "date":
      return "2023-11-07";
    case "uuid":
      return "<uuid>";
    case "email":
      return "<email>";
    case "uri":
    case "url":
      return "<url>";
    default:
      return "<string>";
  }
}
