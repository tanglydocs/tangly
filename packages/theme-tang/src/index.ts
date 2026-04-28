export const THEME_NAME = "tang" as const;

export { themeConfig, type TangThemeConfig } from "./theme.config.js";

// Astro components are imported directly via subpath:
//   import Layout from "@tangly/theme-tang/Layout.astro";
// The exports map (`./*`) makes the .astro files importable from src/.
