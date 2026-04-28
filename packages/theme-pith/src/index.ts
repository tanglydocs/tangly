export const THEME_NAME = "pith" as const;

export { themeConfig, type TangThemeConfig as PithThemeConfig } from "./theme.config.js";

// Astro components are imported directly via subpath:
//   import Layout from "@tangly/theme-pith/Layout.astro";
// The exports map (`./*`) makes the .astro files importable from src/.
