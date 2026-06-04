/**
 * Per-theme social-card styling + the satori element tree for a 1200x630 card.
 *
 * Pure module: no `fs`, no Astro/virtual imports — takes plain data so it can
 * be unit-reasoned and reused by the OG endpoint. The renderer (`og-render.ts`)
 * feeds the tree to satori.
 *
 * satori CSS notes: flexbox only; container divs must declare `display:flex`;
 * text-bearing divs take a single string child (no flex); spacing via
 * margin/padding (avoid `gap`); fonts referenced by family name + weight must
 * match a buffer loaded in `og-render.ts`.
 */

import type { DocsJson } from "@tanglydocs/schema";

/** Resolved theme aliases collapse to these five card families. */
export type CardTheme = "tang" | "pith" | "pip" | "readable" | "geist";

export interface CardStyle {
  /** Card background (hex). */
  bg: string;
  /** Title color (hex). */
  fg: string;
  /** Description / secondary text color (hex). */
  mute: string;
  /** Accent color (hex) — bar, rule, eyebrow. */
  accent: string;
  /** Title font family (must be bundled in og-render). */
  titleFamily: "Inter" | "Spectral" | "Crimson Pro";
  /** Accent treatment along the top of the card. */
  treatment: "bar" | "rule" | "hairline";
  /** Optional two-stop gradient for the `bar` treatment (135deg). */
  gradient?: [string, string];
}

/**
 * Grounded in each theme package's `styles/theme.css`. One renderer, per-theme
 * descriptor, keeps the card on-brand for whichever theme the project uses.
 */
const STYLE_BY_THEME: Record<CardTheme, CardStyle> = {
  tang: {
    bg: "#FAFAF7",
    fg: "#0B0B0F",
    mute: "#6B6B70",
    accent: "#EA580C",
    titleFamily: "Inter",
    treatment: "bar",
    gradient: ["#F97316", "#C2410C"],
  },
  pith: {
    bg: "#FBFAF6",
    fg: "#1C1917",
    mute: "#6B6B70",
    accent: "#1F56C8",
    titleFamily: "Spectral",
    treatment: "rule",
  },
  pip: {
    bg: "#FFFFFF",
    fg: "#18181B",
    mute: "#71717A",
    accent: "#16A34A",
    titleFamily: "Inter",
    treatment: "bar",
  },
  readable: {
    bg: "#F7F1E3",
    fg: "#2B2118",
    mute: "#6B5D4F",
    accent: "#8B3A1D",
    titleFamily: "Crimson Pro",
    treatment: "rule",
  },
  geist: {
    bg: "#FFFFFF",
    fg: "#0A0A0A",
    mute: "#6B7280",
    accent: "#0A0A0A",
    titleFamily: "Inter",
    treatment: "hairline",
  },
};

const THEME_ALIASES: Record<string, CardTheme> = {
  tang: "tang",
  pith: "pith",
  pip: "pip",
  readable: "readable",
  geist: "geist",
  // Mintlify theme aliases all map to tang (mirrors resolveTheme()).
  mint: "tang",
  maple: "tang",
  palm: "tang",
  willow: "tang",
  linden: "tang",
  almond: "tang",
  aspen: "tang",
  luma: "tang",
  sequoia: "tang",
};

/**
 * Resolve the card style for a project: pick the theme descriptor, then layer
 * `docs.json` overrides (`thumbnails.background`, `thumbnails.accent`, or the
 * primary brand color) on top.
 */
export function resolveCardStyle(config: DocsJson): CardStyle {
  const themeName = typeof config.theme === "string" ? config.theme : "tang";
  const base = STYLE_BY_THEME[THEME_ALIASES[themeName] ?? "tang"];

  const thumbnails = config.thumbnails as { background?: string; accent?: string } | undefined;
  const accent = thumbnails?.accent ?? config.colors?.primary ?? base.accent;
  const bg =
    thumbnails?.background && thumbnails.background.startsWith("#")
      ? thumbnails.background
      : base.bg;

  return { ...base, accent, bg, gradient: base.gradient };
}

export interface CardContent {
  title: string;
  description?: string;
  /** Small uppercase label above the title (tab / section name). */
  eyebrow?: string;
  siteName: string;
  /** `data:` URI for the project logo, embedded in the footer. */
  logoDataUri?: string;
}

// Minimal hyperscript: satori reads `{ type, props: { style, children } }`.
type El = { type: string; props: Record<string, unknown> };
function h(type: string, style: Record<string, unknown>, children?: El[] | string): El {
  return { type, props: { style, ...(children === undefined ? {} : { children }) } };
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Title size scales down as the title gets longer so it never overflows. */
function titleSize(title: string): number {
  if (title.length <= 28) return 70;
  if (title.length <= 52) return 58;
  return 46;
}

/** Build the satori element tree for a card. */
export function buildCard(style: CardStyle, content: CardContent): El {
  const title = truncate(content.title, 80);
  const description = content.description ? truncate(content.description, 150) : "";
  const eyebrow = content.eyebrow ? truncate(content.eyebrow, 40).toUpperCase() : "";

  const top: El[] = [];

  // Top accent treatment. satori rejects `undefined` style values (it calls
  // .trim() on them), so only set the background key we actually use.
  if (style.treatment === "bar") {
    top.push(
      h("div", {
        display: "flex",
        width: "1200px",
        height: "14px",
        ...(style.gradient
          ? {
              backgroundImage: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
            }
          : { backgroundColor: style.accent }),
      }),
    );
  }

  // Eyebrow + title + description, top-aligned.
  const headerChildren: El[] = [];
  if (style.treatment === "rule") {
    headerChildren.push(
      h("div", {
        display: "flex",
        width: "72px",
        height: "6px",
        backgroundColor: style.accent,
        marginBottom: "28px",
      }),
    );
  }
  if (eyebrow) {
    headerChildren.push(
      h(
        "div",
        {
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: "24px",
          letterSpacing: "2px",
          color: style.accent,
          marginBottom: "20px",
        },
        eyebrow,
      ),
    );
  }
  headerChildren.push(
    h(
      "div",
      {
        fontFamily: style.titleFamily,
        fontWeight: 700,
        fontSize: `${titleSize(title)}px`,
        lineHeight: 1.1,
        color: style.fg,
        letterSpacing: "-0.5px",
      },
      title,
    ),
  );
  if (description) {
    headerChildren.push(
      h(
        "div",
        {
          fontFamily: "Inter",
          fontWeight: 400,
          fontSize: "30px",
          lineHeight: 1.4,
          color: style.mute,
          marginTop: "28px",
        },
        description,
      ),
    );
  }

  const header = h(
    "div",
    { display: "flex", flexDirection: "column", maxWidth: "1000px" },
    headerChildren,
  );

  // Footer: the logo if we have one (logos are usually a wordmark/lockup, so
  // showing the site name too would double up), otherwise the site name.
  const footer = content.logoDataUri
    ? {
        type: "img",
        props: { src: content.logoDataUri, style: { height: "48px" } },
      }
    : h(
        "div",
        {
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: "30px",
          color: style.fg,
        },
        content.siteName,
      );

  const content_ = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      flexGrow: 1,
      width: "1200px",
      padding: "80px",
    },
    [header, footer],
  );

  top.push(content_);

  return h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: "1200px",
      height: "630px",
      backgroundColor: style.bg,
      ...(style.treatment === "hairline" ? { border: `1px solid ${style.fg}1A` } : {}),
    },
    top,
  );
}
