# Parity Report — Tangly vs `mintlify dev`

Corpus: `~/Projects/Opennem/opennem/docs` (Open Electricity Documentation, 47 mdx, 5 tabs).

`tangly dev`: <http://localhost:4321>
`mintlify dev`: <http://localhost:3050>

Last updated: 2026-04-29

## 2026-04-29 sweep — fixes & remaining gaps

Fixed this round:
- Footer: hardcoded `Powered by Tangly → github.com/tanglydocs` retargeted to `https://tangly.dev`. Single GitHub in footer now.
- Footer socials: skip-render unmapped keys (no more `?`/Link fallback).
- Sidebar default-expanded: `expanded ?? containsCurrent ?? true` was a `??`-vs-boolean bug that defaulted to "open only on active branch". Now `expanded ?? true` → all groups open.
- Heading anchors: literal `#` text replaced with hover-only Lucide `Link` SVG (rehype-autolink content tree + `.tangly-heading-anchor` CSS in both prose stylesheets).
- Prose vertical rhythm: `.prose-tang p { margin: 0 }` was killing all paragraph spacing; switched to `font-size + line-height` and let `> * + *` handle margins.
- H2 border-bottom (GitHub-style HR) removed for Mintlify-style flat headings.
- H1 retuned: `text-3xl font-bold` (30px / 700) to match Mintlify; was `text-3xl sm:text-4xl font-semibold`.
- Lucide v1 brand-icon dropouts (Github, Twitter/X, LinkedIn, YouTube, Slack, Discord) — added inline SVG fallbacks in `Icon.astro` for both themes. Expanded FA→Lucide map for `network-wired`, `smog`, `industry`, `arrows-up-down`, `list-check`, etc.

Remaining gaps (parity sweep — Open Electricity corpus):
- **OpenAPI endpoint renderer**: `/api-reference/data/get-network-data` shows method+path + try-it-out, but parameter sections render as a flat list (0 H2). Mintlify breaks parameters into `Path / Query / Body` H2 blocks with 21 ParamFields. Tangly's `OpenApiEndpoint.astro` needs section grouping.
- **Topnav GitHub appears twice**: docs.json has `navigation.global.anchors[github]` AND `navbar.links[github]` with different hrefs (org vs repo). Source-of-truth is the user's docs.json — flag for them, not a Tangly bug.
- **TOC + page chrome**: confirmed working but should QA on a long page with nested H3s.

## Summary

| Area                                          | Status                                    |
| --------------------------------------------- | ----------------------------------------- |
| docs.json schema parsing                      | ✓ Parses unmodified                       |
| Manifest (47 pages → 39 nav slugs)            | ✓                                         |
| Static asset serving (`/images/...`)          | ✓                                         |
| MDX components (Note/Card/CardGroup/Callouts) | ✓ Render correctly                        |
| Lucide icons                                  | ✓ Inline SVG                              |
| Sidebar tree                                  | ✓                                         |
| Pagination prev/next                          | ✓                                         |
| Top nav tabs                                  | ✓ Hrefs go to first page in tab           |
| OpenAPI tab                                   | ✓ SSR fetch + endpoint render             |
| Tailwind v4 CSS                               | ⚠ Not visible in DOM — needs verification |
| Search Cmd+K                                  | ✗ Placeholder (Phase 4)                   |
| Light/Dark toggle                             | ✓ Button present                          |
| Footer socials                                | ✓                                         |
| Eyebrow above H1 ("Get Started")              | ✗ Mintlify has it, Tangly missing         |
| Heading anchor `Navigate to header`           | ✓ rehype-slug + rehype-autolink-headings  |

## Open issues (priority order)

### 1. Tab hrefs go to slugified tab name instead of first page

**Impact**: Top nav tabs are broken — clicking "Documentation" goes to `/documentation` (404 in our system).
**Mintlify**: tab "Documentation" → `/introduction`, "API Reference" → `/api-reference/overview`, "SDKs" → `/sdk/overview`, "How-To" → `/howto/getting-started`, "Contribute" → `/contribute/overview`.
**Fix**: TopNav must compute `firstPageOf(tab)` and link there.

### 2. Eyebrow row above H1 missing

Mintlify shows the parent group name ("Get Started") as a small eyebrow above the H1. Our PageShell has breadcrumbs (good) but lacks this small-caps eyebrow.

### 3. Heading anchors

Mintlify wraps each `<h2>`/`<h3>` with a hover-revealed anchor link. We use the raw heading. Add via remark/rehype-slug + rehype-autolink-headings.

### 4. CSS not loading

Tailwind v4 classes appear in DOM but no `<link rel="stylesheet">` shows in head. Need to import `theme.css` from a layout that Astro will process and emit. May already work (Layout imports them) — verify in browser.

### 5. OpenAPI tab not wired

The `API Reference` tab uses `openapi:` frontmatter. Phase 1.7 needs to mount Scalar.

## Strengths (Tangly already at parity)

- Logo (light + dark variants) renders.
- All 5 nav tabs visible with correct labels.
- Search button with Cmd+K hint chip.
- Anchors (GitHub, Website) in TopNav.
- Navbar links (Tracker, GitHub, Blog) inline.
- Theme toggle button.
- Platform CTA button.
- Sidebar with all groups (Get Started, Guides, Platform).
- Article: breadcrumbs, h1, description, full MDX content.
- Note callouts — exact same shape as Mintlify (icon + content row).
- Image render at `/images/openelectricity_page.png`.
- Card/CardGroup at bottom of intro page (4 cards in 2-col grid).
- Pagination (Next: Community).
- Right-rail TOC (5 entries: Website, API Platform, Supported Data Sets, About, Next Steps).
- Footer x + github socials.
- "Powered by Tangly" text + link (the divergence-by-design from Mintlify).
