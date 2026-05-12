import type { DocsJson } from "@tanglydocs/schema";
import type { ResolvedTab } from "../manifest/types.js";

const ENV_VAR = "TANGLY_OPENAPI_URL";

/**
 * If `TANGLY_OPENAPI_URL` is set, replace every OpenAPI source in the
 * manifest (top-level `api.openapi` plus per-tab `openapi`) with the
 * override. Lets dev/preview point at a non-prod spec without editing
 * docs.json; unset env var → no-op (prod path).
 *
 * Mutates `config.api.openapi` and each `tab.openapi` in place so all
 * downstream consumers (build-time spec expansion, SSR title/desc fetch,
 * OpenApiEndpoint prop) see the override without further wiring.
 */
export function applyOpenApiOverride(config: DocsJson, tabs: ResolvedTab[]): void {
  const override = process.env[ENV_VAR]?.trim();
  if (!override) return;

  let touched = false;
  const api = config.api as { openapi?: string | string[] } | undefined;
  if (api?.openapi !== undefined) {
    api.openapi = override;
    touched = true;
  }
  for (const tab of tabs) {
    if (tab.openapi !== undefined) {
      tab.openapi = override;
      touched = true;
    }
  }
  if (touched) {
    console.log(`[tangly] OpenAPI source overridden via ${ENV_VAR}=${override}`);
  }
}
