/**
 * Default configuration for the Tang theme. Consumed by the Tangly framework
 * to drive layout dimensions, breakpoints, and font defaults.
 */
export const themeConfig = {
  name: "tang",
  defaults: {
    sidebarWidth: "17rem",
    contentMaxWidth: "48rem",
    tocWidth: "15rem",
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280 },
    fonts: {
      heading: "DM Sans",
      body: "DM Sans",
      mono: "JetBrains Mono",
    },
  },
} as const;

export type TangThemeConfig = typeof themeConfig;
