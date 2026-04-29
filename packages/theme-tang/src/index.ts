export const THEME_NAME = "tang" as const;

// All UI surface lives in @tanglydocs/theme-ui — re-export for convenience so
// `import { themeConfig } from "@tanglydocs/theme-tang"` keeps working. The
// active `styles/theme.css` is wired in via Vite alias by the Tangly Astro
// integration (see packages/tangly/src/plugin/integration.ts).
export { themeConfig, type TangThemeConfig } from "@tanglydocs/theme-ui/theme.config.js";
