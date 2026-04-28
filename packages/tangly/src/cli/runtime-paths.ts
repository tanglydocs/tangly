import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Locate the synthesized Astro runtime shipped inside this package. */
export function getRuntimeDir(): string {
  // dist/cli/runtime-paths.js → up two levels → packages/tangly → runtime
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../../runtime"), resolve(here, "../../../runtime")];
  for (const c of candidates) {
    if (existsSync(resolve(c, "astro.config.mjs"))) return c;
  }
  throw new Error(`Could not locate Tangly runtime directory. Tried: ${candidates.join(", ")}`);
}
