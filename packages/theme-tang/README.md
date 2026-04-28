# @tangly/theme-tang

> Default theme for [Tangly](https://github.com/tanglydocs/tangly) — a self-hosted, OSS docs framework that renders Mintlify projects unmodified.

The **Tang** theme is the out-of-the-box Astro layout for Tangly. It renders a top nav, sidebar, optional right-rail TOC, and footer driven entirely by `docs.json` plus per-page MDX frontmatter.

## Status

Early preview. Visuals and APIs may shift.

## Stack

- Astro 6 SFCs (`.astro`)
- Tailwind v4 (utility classes inline, no config — JIT)
- Lucide icons (via `lucide`)
- Vanilla inline JS only — no React or other component frameworks
- TypeScript strict mode

## Files

- `Layout.astro` — root HTML document, head, body grid, dark-mode bootstrap, mobile drawer.
- `TopNav.astro` — sticky glassy header (logo, tabs, search, anchors, links, theme toggle, primary CTA).
- `Sidebar.astro` — recursive nested groups with active state, icons, tags, collapsible details.
- `Footer.astro` — socials row, footer link groups, "Powered by Tangly" credit.
- `PageShell.astro` — page wrapper: breadcrumbs, h1, subtitle, MDX slot, prev/next, scrollspy TOC.
- `styles/theme.css` — CSS variables driven by `docs.json` colors + Tailwind import.
- `styles/prose.css` — typography for MDX-rendered body content (`.prose-tang`).
- `theme.config.ts` — exported defaults for sidebar/content/TOC widths, breakpoints, fonts.

## Usage

The framework wires this theme automatically when `docs.json` selects `theme: "tang"` (the default). Component imports use the subpath exports:

```astro
---
import Layout from "@tangly/theme-tang/Layout.astro";
import PageShell from "@tangly/theme-tang/PageShell.astro";
---
<Layout config={config} page={page} navigation={navigation} pageTitle={page.frontmatter.title}>
  <PageShell page={page}>
    <slot />
  </PageShell>
</Layout>
```

## Theming

Colors come from `docs.json#/colors`:

```json
{
  "colors": {
    "primary": "#2f73f5",
    "light": "#5a92f7",
    "dark": "#1f56c8",
    "background": { "light": "#ffffff", "dark": "#0b0f17" }
  }
}
```

These flow into CSS variables (`--tangly-color-primary`, `--tangly-color-bg`, etc.). Dark mode is toggled by adding `class="dark"` to `<html>`; the toggle persists in `localStorage`.

## License

MIT.
