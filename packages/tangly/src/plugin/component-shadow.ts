import { existsSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_NAMES = [
  "Accordion",
  "AccordionGroup",
  "Badge",
  "Card",
  "CardGroup",
  "Check",
  "CodeGroup",
  "Columns",
  "Danger",
  "Embed",
  "Expandable",
  "Frame",
  "Icon",
  "Info",
  "Note",
  "OpenApiEndpoint",
  "ParamField",
  "RequestExample",
  "ResponseExample",
  "ResponseField",
  "Snippet",
  "Step",
  "Steps",
  "Tab",
  "Tabs",
  "Tip",
  "Tooltip",
  "Update",
  "Warning",
] as const;

const EXTENSIONS = [".astro", ".tsx", ".jsx", ".ts", ".js"] as const;

/**
 * Build a Vite alias map that points each component name at the user's
 * `./components/<Name>.{astro,tsx,...}` if it exists. Components without a
 * shadow fall through to the theme package.
 *
 * Returns an alias map suitable for `vite.resolve.alias`.
 */
export function buildComponentShadowAliases(userRoot: string): Record<string, string> {
  const userComponentsDir = resolve(userRoot, "components");
  if (!existsSync(userComponentsDir)) return {};

  const aliases: Record<string, string> = {};
  for (const name of COMPONENT_NAMES) {
    for (const ext of EXTENSIONS) {
      const candidate = resolve(userComponentsDir, `${name}${ext}`);
      if (existsSync(candidate)) {
        // Map the shared UI package path → user file. The runtime imports
        // components via `@tangly/theme-ui/components/<Name>.astro`; we
        // override that specific specifier.
        aliases[`@tangly/theme-ui/components/${name}.astro`] = candidate;
        break;
      }
    }
  }

  return aliases;
}

export const SHADOWABLE_COMPONENT_NAMES = COMPONENT_NAMES;
