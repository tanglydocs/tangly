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
