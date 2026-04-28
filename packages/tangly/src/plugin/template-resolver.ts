import { existsSync } from "node:fs";
import { resolve } from "node:path";

const TEMPLATE_EXTENSIONS = [".astro", ".tsx", ".jsx"] as const;

/**
 * Look up a user template by name. Returns the absolute path or null if no
 * matching file exists.
 */
export function findUserTemplate(userRoot: string, templateName: string): string | null {
  if (!templateName) return null;
  const dir = resolve(userRoot, "templates");
  if (!existsSync(dir)) return null;
  // Templates may be referenced bare (e.g. "landing") or with extension.
  const stem = templateName.replace(/\.(astro|tsx?|jsx?)$/i, "");
  for (const ext of TEMPLATE_EXTENSIONS) {
    const candidate = resolve(dir, `${stem}${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

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
