export const THEME_NAME = "tang" as const;

// All UI surface lives in @tangly/theme-ui — re-export for convenience so
// `import { themeConfig } from "@tangly/theme-tang"` keeps working. The
// active `styles/theme.css` is wired in via Vite alias by the Tangly Astro
// integration (see packages/tangly/src/plugin/integration.ts).
export { themeConfig, type TangThemeConfig } from "@tangly/theme-ui/theme.config.js";
