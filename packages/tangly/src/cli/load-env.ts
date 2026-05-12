import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";

const FILES = [".env.local", ".env"] as const;

/**
 * Load `.env.local` then `.env` from the project root into `process.env`.
 *
 * Order matters: `.env.local` is loaded first so its values "stick", then
 * `.env` fills in any gaps. Node's `process.loadEnvFile` never overrides
 * existing keys, so this yields the conventional precedence:
 * shell > .env.local > .env.
 *
 * Logs which files were loaded so a TANGLY_OPENAPI_URL coming from a file
 * is never invisible.
 */
export function loadDotenv(root: string): void {
  const loaded: string[] = [];
  for (const name of FILES) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
      loaded.push(name);
    } catch (err) {
      console.warn(pc.yellow(`⚠ Failed to load ${name}: ${(err as Error).message}`));
    }
  }
  if (loaded.length > 0) {
    console.log(pc.dim(`  Loaded env from ${loaded.join(" + ")}`));
  }
}
