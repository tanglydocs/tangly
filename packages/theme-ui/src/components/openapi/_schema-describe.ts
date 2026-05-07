/**
 * Walk a JSON Schema (already dereferenced — see `_spec-loader.ts`) and
 * pull out the bits a parameter row needs:
 *
 * - `typeLabel`     — readable type expression (e.g. "string[]", "integer | null")
 * - `description`   — top-level schema description
 * - `innerDescription` — when type is array/union, surface the inner item's
 *                       description (Mintlify-style: enum classes carry
 *                       their docstring on the inner schema)
 * - `enumValues`    — comma-friendly list of enum values, drilling into
 *                     `items` and `anyOf` so array-of-enum and nullable
 *                     enums both surface their options.
 * - `defaultValue`  — for the "default: x" pill.
 */

export interface SchemaInfo {
  typeLabel: string;
  description?: string;
  innerDescription?: string;
  enumValues?: string[];
  defaultValue?: string;
}

type S = Record<string, unknown> | undefined | null;

const stringify = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
};

export function describeSchema(schema: unknown): SchemaInfo {
  if (!schema || typeof schema !== "object") {
    return { typeLabel: "any" };
  }
  const s = schema as Record<string, unknown>;
  const out: SchemaInfo = {
    typeLabel: typeLabel(s),
  };
  if (typeof s.description === "string") out.description = s.description;
  const inner = innerSchema(s);
  if (inner && typeof inner.description === "string") {
    out.innerDescription = inner.description;
  }
  const en = collectEnum(s);
  if (en) out.enumValues = en;
  if (s.default !== undefined) out.defaultValue = stringify(s.default);
  return out;
}

function typeLabel(s: Record<string, unknown>): string {
  if (Array.isArray(s.anyOf)) {
    return (s.anyOf as Record<string, unknown>[]).map(typeLabel).join(" | ");
  }
  if (Array.isArray(s.oneOf)) {
    return (s.oneOf as Record<string, unknown>[]).map(typeLabel).join(" | ");
  }
  if (Array.isArray(s.enum) && s.enum.length > 0) {
    // For short enums, show the values inline; for long ones, fall back
    // to the type so the row stays scannable.
    if (s.enum.length <= 4) return (s.enum as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
    return typeof s.type === "string" ? s.type : "enum";
  }
  if (s.type === "array") {
    const items = s.items as Record<string, unknown> | undefined;
    return `${typeLabel(items ?? {})}[]`;
  }
  if (s.type === "null") return "null";
  if (typeof s.type === "string") {
    return typeof s.format === "string" ? `${s.type} (${s.format})` : s.type;
  }
  if (s.$ref && typeof s.$ref === "string") return s.$ref.split("/").pop() ?? "ref";
  return "any";
}

function innerSchema(s: Record<string, unknown>): S {
  if (s.type === "array" && s.items && typeof s.items === "object") {
    return s.items as Record<string, unknown>;
  }
  if (Array.isArray(s.anyOf)) {
    // Pick the first non-null variant
    for (const v of s.anyOf as Record<string, unknown>[]) {
      if (v && v.type !== "null") return v;
    }
  }
  return null;
}

function collectEnum(s: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(s.enum) && s.enum.length > 0) {
    return (s.enum as unknown[]).map(stringify);
  }
  if (s.type === "array" && s.items && typeof s.items === "object") {
    return collectEnum(s.items as Record<string, unknown>);
  }
  if (Array.isArray(s.anyOf)) {
    for (const v of s.anyOf as Record<string, unknown>[]) {
      const inner = collectEnum(v);
      if (inner) return inner;
    }
  }
  return undefined;
}
