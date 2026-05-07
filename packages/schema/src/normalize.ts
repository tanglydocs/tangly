/**
 * Normalize Mintlify-flavored docs.json keys into Tangly-native shapes
 * before Zod parses. Lets unmodified Mintlify projects keep working
 * while we expose cleaner names to new authors.
 *
 * Aliases handled:
 *   api.examples.*       → api.codeSamples.*
 *   api.examples.languages → api.codeSamples.languages
 *
 * Mutates a shallow clone — never the caller's object.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function normalizeDocsJson(input: unknown): unknown {
  if (!isObject(input)) return input;
  const out: Json = { ...input };

  if (isObject(out.api)) {
    const api: Json = { ...out.api };

    if (isObject(api.examples)) {
      const incoming = api.examples;
      const existing = isObject(api.codeSamples) ? api.codeSamples : {};
      // Tangly-native wins on conflict — explicit `codeSamples` is intentional.
      api.codeSamples = { ...incoming, ...existing };
      delete api.examples;
    }

    out.api = api;
  }

  return out;
}
