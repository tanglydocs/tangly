/**
 * Normalize Mintlify-flavored docs.json keys into Tangly-native shapes
 * before Zod parses. Lets unmodified Mintlify projects keep working
 * while we expose cleaner names to new authors.
 *
 * Aliases handled:
 *   api.examples.*       → api.codeSamples.*
 *   api.examples.languages → api.codeSamples.languages
 *   api.playground.display → api.playground.mode  (none→hide, auth→interactive)
 *   fonts (bare font-face) → fonts.{heading,body}
 *
 * Mutates a shallow clone — never the caller's object.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Mintlify `fonts` may be a bare font-face (`{ family, weight, ... }`) that
 * applies to every text role. Tangly theme layouts only read
 * `fonts.heading` / `fonts.body`, so expand the bare form into both. The
 * already-split `{ heading, body }` shape (no `family` key) passes through.
 */
export function normalizeFonts(fonts: unknown): unknown {
  if (!isObject(fonts) || !("family" in fonts)) return fonts;
  return { heading: { ...fonts }, body: { ...fonts } };
}

/**
 * Mintlify renamed `api.playground.mode` → `api.playground.display` and uses
 * `none`/`auth` where Tangly uses `hide`/`interactive`. Rewrite to the native
 * `mode` shape so strict parsing accepts unmodified Mintlify projects.
 *
 * - `none` → `hide` (matches the frontmatter `playground` mapping).
 * - `auth` (show only to signed-in users) has no Tangly equivalent, so it
 *   falls back to `interactive` — the playground stays usable.
 * - Tangly-native `mode` wins if both keys are present; `display` is dropped.
 */
export function normalizePlayground(playground: unknown): unknown {
  if (!isObject(playground) || !("display" in playground)) return playground;
  const { display, ...rest } = playground;
  if ("mode" in rest || display === undefined) return rest;
  const mode = display === "none" ? "hide" : display === "auth" ? "interactive" : display;
  return { ...rest, mode };
}

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

    if (isObject(api.playground)) {
      api.playground = normalizePlayground(api.playground);
    }

    out.api = api;
  }

  if ("fonts" in out) {
    out.fonts = normalizeFonts(out.fonts);
  }

  return out;
}
