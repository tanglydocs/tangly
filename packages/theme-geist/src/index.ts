export const THEME_NAME = "geist" as const;

// Same shape as theme-tang/theme-pith/theme-pip: re-export the shared theme
// config. Geist customises tokens via styles/theme.css and inherits the
// full sidebar+tabs Layout from @tanglydocs/theme-ui.
export {
  themeConfig,
  type TangThemeConfig as GeistThemeConfig,
} from "@tanglydocs/theme-ui/theme.config.js";
