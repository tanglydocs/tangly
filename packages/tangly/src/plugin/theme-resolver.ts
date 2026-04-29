import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveTheme } from "@tangly/schema";

/**
 * Component names that the user can shadow under `<userRoot>/theme/components/`.
 * Mirrors the list in component-shadow.ts.
 */
const SHADOWABLE_COMPONENT_NAMES = [
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

/**
 * Top-level theme files (Layout, PageShell, etc.) that the user can
 * override by dropping a same-named file at `<userRoot>/theme/<Name>.astro`.
 */
const SHADOWABLE_LAYOUT_NAMES = [
  "Layout",
  "PageShell",
  "Sidebar",
  "TopNav",
  "Footer",
  "SearchModal",
] as const;

const EXTENSIONS = [".astro", ".tsx", ".jsx", ".ts", ".js"] as const;

/**
 * Build the alias map that points `@tangly/theme/theme.css` at the active
 * theme's CSS file (theme-tang or theme-pith). The user's
 * `<userRoot>/theme/styles/theme.css` wins over both when present.
 */
export function buildThemeStylesAlias(
  userRoot: string,
  configFile: string,
): Record<string, string> {
  const aliases: Record<string, string> = {};

  // Read docs.json to discover the active theme. resolveTheme() collapses
  // every Mintlify alias (mint, maple, palm, ...) into "tang" | "pith".
  let activeTheme: "tang" | "pith" = "tang";
  try {
    const path = resolve(userRoot, configFile);
    if (existsSync(path)) {
      const cfg = JSON.parse(readFileSync(path, "utf8")) as { theme?: string };
      activeTheme = resolveTheme(cfg.theme);
    }
  } catch {
    // ignore — fall through to default "tang"
  }

  // Resolve to absolute path so Vite always has a concrete file. Walks up
  // from this file (`packages/tangly/src/plugin/theme-resolver.ts`) to
  // `packages/`, then into the active theme's css.
  const here = new URL(".", import.meta.url).pathname;
  const themeCssPath = resolve(
    here,
    "..",
    "..",
    "..",
    `theme-${activeTheme}`,
    "src",
    "styles",
    "theme.css",
  );

  // User override wins.
  const userThemeCss = resolve(userRoot, "theme", "styles", "theme.css");
  aliases["@tangly/theme/theme.css"] = existsSync(userThemeCss)
    ? userThemeCss
    : themeCssPath;

  return aliases;
}

/**
 * Build alias map for `<userRoot>/theme/components/<Name>.{astro,tsx,...}`
 * and `<userRoot>/theme/<Name>.{astro,...}` overrides of theme-ui shells.
 *
 * Resolution: drop a file at `<userRoot>/theme/components/Card.astro` to
 * override `@tangly/theme-ui/components/Card.astro` everywhere it's
 * imported. Drop `<userRoot>/theme/Layout.astro` to swap the page shell.
 */
export function buildUserThemeAliases(userRoot: string): Record<string, string> {
  const themeDir = resolve(userRoot, "theme");
  if (!existsSync(themeDir)) return {};

  const aliases: Record<string, string> = {};

  // Component overrides: <userRoot>/theme/components/<Name>.<ext>
  const componentsDir = resolve(themeDir, "components");
  if (existsSync(componentsDir)) {
    for (const name of SHADOWABLE_COMPONENT_NAMES) {
      for (const ext of EXTENSIONS) {
        const candidate = resolve(componentsDir, `${name}${ext}`);
        if (existsSync(candidate)) {
          aliases[`@tangly/theme-ui/components/${name}.astro`] = candidate;
          break;
        }
      }
    }
  }

  // Top-level layout overrides: <userRoot>/theme/<Name>.<ext>
  for (const name of SHADOWABLE_LAYOUT_NAMES) {
    for (const ext of EXTENSIONS) {
      const candidate = resolve(themeDir, `${name}${ext}`);
      if (existsSync(candidate)) {
        aliases[`@tangly/theme-ui/${name}.astro`] = candidate;
        break;
      }
    }
  }

  return aliases;
}
