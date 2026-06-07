/**
 * A user-facing configuration error whose `.message` is already a fully
 * rendered, friendly block (key + reason + fix). CLI commands print it
 * verbatim — no `✗` prefix, no stack trace — so the formatting survives.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * If `err` is a {@link ConfigError}, print its pre-rendered block to stderr and
 * return `true` (the caller should then `process.exit(1)`); otherwise return
 * `false` so the caller can rethrow. Shared by `check`/`dev`/`build` so all
 * three surface the same friendly docs.json error instead of an Astro/Node
 * stack trace.
 */
export function reportConfigError(err: unknown): boolean {
  if (err instanceof ConfigError) {
    console.error(err.message);
    return true;
  }
  return false;
}
