export const THEME_NAME = "pip" as const;

// Same shape as theme-tang/theme-pith: re-export the shared theme config
// from @tangly/theme-ui. Pip customises tokens via styles/theme.css and
// ships its own Layout + PageShell to drop the sidebar entirely.
export {
  themeConfig,
  type TangThemeConfig as PipThemeConfig,
} from "@tangly/theme-ui/theme.config.js";
