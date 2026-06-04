import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Build a Vite alias map for templates. Each existing template becomes
 * `@user-template/<name>` so the runtime can resolve it dynamically.
 */
export function buildTemplateAliases(userRoot: string): Record<string, string> {
  const dir = resolve(userRoot, "templates");
  if (!existsSync(dir)) return {};

  // We don't pre-walk the directory — the runtime will dynamically import
  // `@user-template/<name>` and Vite will resolve it lazily via this alias
  // base. Map a single entry so Vite knows the prefix.
  return {
    "@user-template": dir,
  };
}
