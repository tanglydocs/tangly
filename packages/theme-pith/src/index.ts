export const THEME_NAME = "pith" as const;

// Same shape as theme-tang: re-export the shared theme config from
// @tangly/theme-ui. Pith only customises tokens via styles/theme.css.
export {
  themeConfig,
  type TangThemeConfig as PithThemeConfig,
} from "@tangly/theme-ui/theme.config.js";
