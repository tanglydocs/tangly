import { z } from "zod";

export const TANGLY_THEMES = ["tang", "pith", "pip", "readable", "geist"] as const;

/**
 * docs.json `theme` accepts canonical Tangly theme names. Unknown values
 * (including legacy aliases from other docs frameworks) are tolerated as
 * plain strings so projects mid-migration don't fail validation; they
 * fall through to the default "tang" via {@link resolveTheme}.
 *
 * The dedicated `tangly migrate` command translates legacy aliases to
 * canonical names at migration time — that's where the compat list lives.
 */
export const ThemeSchema = z.enum(TANGLY_THEMES).or(z.string()).default("tang");

export type Theme = z.infer<typeof ThemeSchema>;

export type ResolvedTheme = (typeof TANGLY_THEMES)[number];

export function resolveTheme(theme: Theme | string | undefined): ResolvedTheme {
  if (theme === "pith") return "pith";
  if (theme === "pip") return "pip";
  if (theme === "readable") return "readable";
  if (theme === "geist") return "geist";
  return "tang";
}
