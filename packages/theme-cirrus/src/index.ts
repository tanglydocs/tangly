export const THEME_NAME = "cirrus" as const;

// Same shape as theme-geist: re-export the shared theme config. Cirrus
// customises tokens and prose density via styles/theme.css and inherits the
// full sidebar+tabs Layout from @tanglydocs/theme-ui.
export {
  themeConfig,
  type TangThemeConfig as CirrusThemeConfig,
} from "@tanglydocs/theme-ui/theme.config.js";
