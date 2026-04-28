import { z } from "zod";

export const MINTLIFY_THEMES = [
  "mint",
  "maple",
  "palm",
  "willow",
  "linden",
  "almond",
  "aspen",
  "luma",
  "sequoia",
] as const;

export const TANGLY_THEMES = ["tang", "pith"] as const;

export const ThemeSchema = z.enum([...MINTLIFY_THEMES, ...TANGLY_THEMES]).default("tang");

export type Theme = z.infer<typeof ThemeSchema>;

export function resolveTheme(theme: Theme | string | undefined): "tang" | "pith" {
  if (theme === "pith") return "pith";
  return "tang";
}
