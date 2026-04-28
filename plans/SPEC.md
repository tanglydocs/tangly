# Tangly — Build Plan

A self-hosted, open-source documentation framework that renders Mintlify projects unmodified and ships sharper authoring primitives on top.

This document is the brief for Claude Code. Read it top to bottom before starting Phase 0. Each phase has explicit acceptance criteria that gate the next one.

---

## 1. North Star

Build the docs framework you would actually want to use. It must:

1. Render any existing Mintlify project (`docs.json` + `*.mdx`) without source edits.
2. Run `tangly dev` in under 2 seconds and hot-reload everything — including `docs.json`.
3. Build to a static site that drops onto Vercel or Cloudflare with no server work.
4. Stay simple enough that one person can hold the whole codebase in their head.

If a feature compromises any of these four, push it to a later phase or drop it.

---

## 2. Tech Stack (Locked)

- **Astro 5** as the rendering engine. We use Astro programmatically — users never see Astro config.
- **MDX** via `@astrojs/mdx`, with `remark-gfm` and `rehype-shiki`.
- **TypeScript** strict mode everywhere.
- **Zod** for `docs.json` validation, frontmatter validation, and content collections.
- **citty** for the CLI (used by Nuxt/Nitro).
- **@clack/prompts** for interactive flows.
- **picocolors** for terminal output.
- **chokidar** for file watching.
- **gray-matter** for frontmatter parsing.
- **Sharp** (via Astro Image) for image optimization.
- **pnpm** + **Turborepo** for the monorepo.
- **Vitest** for unit tests, **Playwright** for visual regression.

Do not introduce other frameworks. Do not introduce React Router, Next.js, TanStack Start, or Vite directly — Astro wraps Vite for us.

---

## 3. Repository Layout

Monorepo at the project root:

```
tangly/
├── packages/
│   ├── tangly/                  # the npm package users install
│   │   ├── bin/
│   │   │   └── tangly.js        # CLI entrypoint
│   │   ├── src/
│   │   │   ├── cli/             # citty commands
│   │   │   ├── astro/           # synthesized Astro app template
│   │   │   ├── manifest/        # nav → manifest builder
│   │   │   ├── mdx/             # MDX components, remark/rehype plugins
│   │   │   ├── schema/          # docs.json Zod schema (re-exports from @tangly/schema)
│   │   │   └── adapters/        # vercel/cloudflare/static auto-detect
│   │   └── package.json
│   ├── schema/                  # @tangly/schema — Zod + JSON Schema for docs.json
│   ├── theme-tang/              # @tangly/theme-tang (default theme)
│   └── theme-pith/              # @tangly/theme-pith (second theme)
├── examples/
│   ├── basic/                   # hello-world
│   ├── api-docs/                # OpenAPI example
│   └── port-from-mintlify/      # cloned Mintlify docs repo for parity testing
├── tests/
│   ├── fixtures/                # small docs.json + mdx test cases
│   ├── parity/                  # side-by-side render diffs vs Mintlify
│   └── e2e/                     # Playwright
├── docs/                        # Tangly's own docs site, built with Tangly
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 4. Compatibility Surface

These are the Mintlify behaviors we replicate exactly. If a real Mintlify project breaks on Tangly, it is a bug.

### 4.1 `docs.json`

Top-level fields we accept and pass through to the layout:
`$schema`, `theme`, `name`, `description`, `colors` (primary/light/dark/anchors), `logo` (light/dark/href), `favicon`, `navigation`, `navbar`, `footer`, `redirects`, `seo`, `analytics`, `api` (baseUrl/auth/playground), `appearance`, `background`, `fonts`, `styling`, `integrations`, `errors`, `contextual`.

Mintlify theme names (`mint`, `maple`, `palm`, `willow`, `linden`, `almond`) all alias to Tangly's `tang` theme by default. Users can override.

`$ref` JSON-pointer resolution: paths must be relative and stay within the project root. Reject path traversal.

### 4.2 Navigation Model

Recursive structure with these node types, freely nestable:

- `pages` — array of page paths (or nested groups)
- `groups` — `{ group, icon?, root?, pages, tag?, expanded? }`
- `tabs` — `{ tab, icon?, href?, openapi?, pages|groups|... }`
- `anchors` — `{ anchor, icon, href|pages|groups }`
- `dropdowns` — `{ dropdown, icon, href|pages|groups }`
- `versions` — `{ version, default?, ...nav }`
- `languages` — `{ language, ...nav }`
- `products` — top-level swappable

Pages are referenced by path without `.mdx`. Pages on disk but not in nav are still routable but hidden from sidebars (matches Mintlify).

### 4.3 Frontmatter

Required: `title`. Optional: `sidebarTitle`, `description`, `icon`, `tag`, `api`, `openapi`, `keywords`, `noindex`, `mode` (`default` | `wide` | `center` | `custom`), plus arbitrary user fields passed to the active template.

### 4.4 MDX Components (Phase 1 set)

These components must work without imports — they're auto-injected as MDX globals:

```
Card, CardGroup, Columns
Steps, Step
Accordion, AccordionGroup
Note, Warning, Info, Tip, Check, Danger
Tabs, Tab
CodeGroup
Frame, Tooltip, Icon, Badge, Update
Expandable
ParamField, ResponseField, RequestExample, ResponseExample
Snippet
```

Match Mintlify's prop signatures exactly. When in doubt, render a Mintlify project and diff.

### 4.5 Conventions

- `snippets/` — reusable MDX/JSX (not routed)
- `images/`, `logo/` — static assets, copied to `public/`
- `.mintignore` aliased to `.tanglyignore` — both work
- `mint.json` auto-detected; `tangly upgrade` migrates it

---

## 5. Tangly Improvements Over Mintlify

These are the wins we ship. Each has a target phase. Implementation notes inline.

### 5.1 Custom page templates _(Phase 2)_

Frontmatter `template: "landing"` resolves to `./templates/landing.astro` (or `.tsx`) in the user's repo. Templates receive `{ frontmatter, children, manifest, page }`. If the template name doesn't exist in `./templates/`, fall back to the default and log a warning.

Section-level inheritance: a group node in `docs.json` can carry `"template": "api-overview"` and all descendant pages inherit unless overridden by their own frontmatter.

### 5.2 Section defaults _(Phase 2)_

A `_section.mdx` file in any folder provides default frontmatter for siblings and descendants. Cascading: closest `_section.mdx` wins, frontmatter on the page itself wins over that.

Alternative form: `_meta.json` for users who don't want the MDX overhead.

Inheritable fields: `template`, `mode`, `tag`, `noindex`, `seo`, `aiContext`, plus any custom fields.

### 5.3 Content collections with Zod schemas _(Phase 2)_

Users define collections in `tangly.config.ts`:

```ts
import { defineCollection, z } from "tangly/content";

export const collections = {
  changelog: defineCollection({
    schema: z.object({
      version: z.string(),
      date: z.coerce.date(),
      tag: z.enum(["feature", "fix", "breaking"]),
    }),
  }),
};
```

Build-time validation. Typed access from templates: `manifest.collections.changelog` returns the validated entries.

### 5.4 Component shadowing _(Phase 2)_

User drops `./components/Note.tsx` (or `.astro`) and it overrides the default `Note` without forking the theme. Resolution order: user `./components/` → active theme → built-in defaults. Shadowed components must export a default that accepts the same props as the original.

### 5.5 Drafts that actually hide _(Phase 2)_

Frontmatter `draft: true`:

- In dev: page renders normally, sidebar shows a `Draft` badge.
- In build: page is omitted from output. No HTML, no sitemap entry, no llms.txt entry.
- `tangly check --strict` fails if any draft pages remain in nav.

Override via env: `TANGLY_INCLUDE_DRAFTS=1 tangly build` for staging deploys.

### 5.6 Embedded blocks _(Phase 5)_

`<Embed page="billing" block="rate-limits" />` resolves at build time. Block IDs come from heading IDs (auto-generated) or explicit `{#custom-id}` markers after a heading or paragraph.

If the source page changes, all embeds rebuild. Circular embeds error at build time.

### 5.7 Better OpenAPI _(Phase 3)_

`docs.json`:

```json
"api": {
  "openapi": "/openapi.json",
  "viewer": "scalar"
}
```

Viewers: `"scalar"` (default), `"stoplight"`, `"redoc"`. Each is a lazy-loaded component — only the one chosen ships in the bundle.

Companion MDX: a page with `api: "GET /users"` in frontmatter can have narrative MDX content that appears alongside the auto-rendered endpoint. Both sources stay in sync because the page is regenerated when the spec changes.

### 5.8 Live reload — first-class _(Phase 1, escalates in Phase 2)_

Phase 1: Astro's native MDX HMR.
Phase 2: chokidar watches `docs.json` (and any `$ref`d files); on change, the manifest virtual module is invalidated, all affected routes Vite-HMR. No restart. This is the headline DX win — Mintlify requires `Ctrl+C` and restart.

Theme files watched the same way: editing `./theme/components/Sidebar.tsx` reloads only that component.

### 5.9 Versioning and i18n _(Phase 6)_

Schema already supports `versions` and `languages` from Phase 1. Phase 6 adds:

- Version overrides instead of duplication: `pages/billing.mdx` is the base; `pages/billing.v2.mdx` is the v2 override. Diff applied at resolve time.
- Language switcher and version dropdown components in the default theme.
- URL strategy: `/v2/billing`, `/es/billing`, or both `/es/v2/billing` based on order of nesting in docs.json.
- Sitemaps + hreflang tags generated correctly.

---

## 6. Improvements Noted For Later (Not Committed)

Capture these in `FUTURE.md` once the repo exists. Don't build them yet.

- **Mermaid + KaTeX** built in (one-line opt-in via remark/rehype plugins).
- **Extensible callouts** — user registers `<Tldr>` as a callout variant in `tangly.config.ts`.
- **Edit on GitHub** deep links derived from `docs.json` repo URL.
- **Redirects-as-code** — `redirects.ts` returning a function, not just a static map.
- **Build cache per page** — hash MDX + frontmatter + theme version, only recompile changes (matters at 500+ pages).
- **Per-page AI context** — frontmatter `aiContext: "..."` concatenated with retrieved chunks during chat.
- **Plugin API** — third-party packages can register MDX components, remark plugins, and config schema extensions.
- **Web editor** — like Mintlify's, but only as a separate optional package. Not required.
- **Analytics adapters** — Plausible, Fathom, PostHog (Nik already has PostHog in his stack — start there).
- **Comments / feedback widget** — "Was this helpful?" → webhook.
- **A11y audit on build** — fail build on critical axe violations.
- **Image hotlink CDN** — for users on Cloudflare, route image requests through Cloudflare Images automatically.
- **Sub-path hosting** — `/docs` deploys (Mintlify supports this; we should too eventually).

---

## 7. CLI Specification

Single binary `tangly` exposed via the `tangly` npm package. Built with citty.

### Commands

```
tangly dev                  start dev server with HMR
tangly build                production build
tangly preview              serve built dist/ locally
tangly check                validate config + links + frontmatter
tangly init [dir]           scaffold a new project
tangly add <type> <path>    scaffold a new page or snippet
tangly upgrade              migrate mint.json → docs.json + bump tangly
tangly eject                materialize the synthesized Astro project
```

### `tangly dev`

```
--port <n>          default 4321
--host              expose on LAN
--no-open           don't open browser
--tunnel            cloudflared quick tunnel (downloads binary on first use)
--config <path>     alternate docs.json path
--debug             dump generated manifest, verbose logging
```

Startup banner:

```
  ▲ tangly  v0.1.0
  ┃ Squirrelscan Docs · 47 pages · theme: tang
  ┃
  ┃ Local:    http://localhost:4321
  ┃ Network:  http://10.0.0.42:4321
  ┃
  ┃ Press h to show help, q to quit, r to restart
```

### `tangly build`

```
--out <dir>         default ./dist
--adapter <name>    vercel | cloudflare | node | static (auto-detected)
--no-prerender      force SSR-only
--base <path>       deploy under subpath like /docs
--analyze           writes a build report to dist/_tangly/build-report.json
```

Adapter auto-detect:

- `vercel.json` present → vercel
- `wrangler.toml` or `wrangler.jsonc` → cloudflare
- `Dockerfile` or env hint → node
- else → static

### `tangly check`

```
--strict            warnings become errors (CI mode)
--no-links          skip link checking (faster)
--json              machine output
--include-drafts    include draft pages in checks
```

Validates:

1. `docs.json` against Zod schema (clear error messages with path + suggestion)
2. Every nav page reference resolves to an MDX file
3. Every internal link `[text](/path)` resolves
4. Every image src exists on disk
5. Frontmatter against per-collection Zod schemas
6. OpenAPI specs are valid (using `@apidevtools/swagger-parser`)
7. No orphan pages on disk if `--strict-coverage`

Exit code 1 on any error.

### `tangly init`

Interactive flow via @clack/prompts:

1. Project name
2. Template (basic | api | portal | from-mintlify)
3. Primary brand color (with picker)
4. Theme (tang | pith)
5. Initialize git? (default yes)

Writes `docs.json`, example MDX pages, `package.json`, `.gitignore`, `README.md`.

### `tangly add`

```
tangly add page guides/billing
tangly add snippet shared/disclaimer
tangly add changelog 2026-04-15-launch

--template <name>   use a template from ./templates/
--no-nav            don't auto-insert into docs.json navigation
```

### `tangly upgrade`

Idempotent migration from `mint.json` to `docs.json`. Preserves all settings, restructures navigation per Mintlify's published migration rules. Bumps `tangly` to latest in `package.json`. Prints a summary of what changed.

### `tangly eject`

Materializes the synthesized Astro project into the user's repo, removes `tangly` from deps, leaves them with a regular Astro app. The pressure-release valve — document this prominently.

---

## 8. Themes

Ship two themes in Phase 1 (Tang) and Phase 2 (Pith). They demonstrate that the theming system is real.

### Tang (default)

Mintlify-Mint-inspired but cleaner. Light by default, dark mode via `prefers-color-scheme` + toggle. Sidebar left, TOC right, content centered. Font stack: Inter for UI, JetBrains Mono for code. Default brand color falls through to a neutral teal.

### Pith

A denser, editorial alternative. Inspired by handbooks and technical manuals. Serif headings (Spectral or Source Serif), tighter line-height, no right-side TOC by default (TOC at top of page instead). Higher information density. Ships dark mode that's actually dark (not a tinted gray).

Both themes consume the same `docs.json` — switching is just `"theme": "pith"`. Per-color overrides via `colors` field still apply.

### Theme Package Shape

```
packages/theme-tang/
├── src/
│   ├── Layout.astro          # frame, head, body
│   ├── Sidebar.astro
│   ├── TopNav.astro
│   ├── Footer.astro
│   ├── PageShell.astro       # title + description + TOC + feedback
│   ├── components/           # MDX component overrides if any
│   ├── styles/
│   │   ├── theme.css         # CSS vars driven by docs.json colors
│   │   └── prose.css         # body content typography
│   └── theme.config.ts       # exported config (defaults, breakpoints)
├── package.json
└── README.md
```

User overrides at `./theme/Layout.astro` shadow the corresponding theme file. Anything not overridden falls through to the package.

---

## 9. Phased Roadmap

Each phase is gated by acceptance criteria. Do not start the next phase until the current one passes.

### Phase 0 — Foundation (1–2 days)

**Goal:** Empty monorepo that builds, lints, and tests cleanly.

Tasks:

1. Init pnpm workspace + Turborepo
2. Create the four packages (`tangly`, `schema`, `theme-tang`, `theme-pith` — last one is just a placeholder for now)
3. Set up TypeScript strict mode, ESLint (with `@typescript-eslint`), Prettier
4. CI: GitHub Actions running lint + typecheck + test on PR
5. Release script via `changesets`

Acceptance:

- `pnpm install && pnpm build` succeeds with no warnings
- CI green on a noop PR

---

### Phase 1 — MVP: Render existing Mintlify projects (5–7 days)

**Goal:** `tangly dev` and `tangly build` work end-to-end on a real Mintlify project. Ports without source edits. Deploys to Vercel and Cloudflare.

Tasks (in order):

1. **`@tangly/schema`** — full Zod schema for `docs.json`. Export Zod types AND generate JSON Schema (via `zod-to-json-schema`) for editor support. Include parsing for `mint.json` legacy format and a converter function.

2. **Manifest builder** — given a project root, returns:

   ```ts
   {
     config: DocsJson,
     pages: Map<string, PageEntry>,    // path → { mdxFile, frontmatter, breadcrumbs, prev, next, sidebar }
     navigation: NavTree,                // resolved tree
     orphans: string[],                  // mdx on disk not in nav
     warnings: Warning[]
   }
   ```

3. **Synthesized Astro app** — package ships an Astro project template that gets materialized to a temp directory (or virtualized via Vite plugin) on `tangly dev`. The template imports the manifest from a virtual module `virtual:tangly/manifest`.

4. **MDX component set** — implement all components from §4.4 in `@tangly/theme-tang`. Match Mintlify's prop signatures and rendered output as closely as possible. Use Lucide icons by default; map Font Awesome icon names to Lucide equivalents where they exist (fallback to question-mark icon with a console warning otherwise).

5. **Default theme (Tang)** — Layout, Sidebar, TopNav, Footer, PageShell. Light + dark. Sidebar collapsing, TOC scrollspy, breadcrumbs, prev/next nav. Use Tailwind v4 (just-in-time, no config) inside the theme package; expose CSS variables for the colors from `docs.json`.

6. **Routing** — generate Astro routes from the manifest. Static pages get prerendered; versioned/i18n routes are dynamic but not implemented yet (just throw a clear error if encountered in Phase 1).

7. **CLI commands**: `dev`, `build`, `preview`, `init`, `check`. Skip `add`, `upgrade`, `eject` for now.

8. **Adapters** — auto-detect Vercel / Cloudflare / static. Document how to deploy in `examples/basic/README.md`.

9. **Build outputs** — `sitemap.xml`, `llms.txt`, `llms-full.txt`, `robots.txt`. Skip OG images for now.

10. **Code highlighting** — Shiki at build time (rehype-shiki). Pick a default theme that works for both light + dark (e.g. `github-light` + `github-dark` paired).

Test corpus:

- `examples/basic/` — minimal hello-world we ship
- `examples/port-from-mintlify/` — clone of the Mintlify docs repo (`https://github.com/mintlify/docs`). This is the primary parity target.
- One of Nik's projects (start with **SquirrelScan** since it has the most pages). Add as `examples/squirrelscan/` (gitignored, you'll wire it up locally).

**Acceptance criteria:**

- [ ] Mintlify's own docs (`mintlify/docs`) render in Tangly with no MDX file edits — only a `docs.json` if they're still on `mint.json`.
- [ ] Visual diff against mintlify.com/docs is recognizable as the same content (colors and layout will differ since it's our theme, but every page must render with all components intact).
- [ ] `tangly build` produces a working static site under 30s for a 100-page project on a modern laptop.
- [ ] `tangly dev` cold start under 2s for the same project.
- [ ] Site deploys to both Vercel and Cloudflare Pages from a clean repo with the auto-detected adapter — zero manual config.
- [ ] `tangly check` catches a deliberately broken nav reference.

**How to compare against Mintlify:**
Run both `mint dev` (in the original Mintlify project) and `tangly dev` (in a port of the same project) side by side. Walk every page. Note discrepancies in `tests/parity/REPORT.md`. Anything in the components set should be a tight match; layout/theme will differ on purpose.

---

### Phase 2 — DX Wins (4–5 days)

**Goal:** The improvements over Mintlify that fundamentally change daily authoring.

Tasks:

1. **Live reload of `docs.json`** — chokidar watcher → invalidate `virtual:tangly/manifest` → Vite HMR. Test: edit `docs.json` while dev server runs, browser updates within 200ms with no restart.

2. **Component shadowing** — resolution chain: `./components/<Name>.{tsx,astro}` → active theme `components/` → defaults. Document the override contract (props must match).

3. **Drafts** — frontmatter `draft: true`. Hidden in build, visible in dev with badge. Env override `TANGLY_INCLUDE_DRAFTS=1`.

4. **Section defaults** — `_section.mdx` and `_meta.json` cascade. Closest wins, page frontmatter beats both.

5. **Custom page templates** — frontmatter `template: "<name>"` resolves from `./templates/`. Group-level inheritance via `"template"` in nav node.

6. **Content collections with Zod** — `tangly.config.ts` defines collections; build-time validation; typed access from templates via the manifest.

7. **`tangly upgrade`** — `mint.json` → `docs.json` migrator. Print a diff summary.

8. **`tangly add`** — page/snippet/changelog scaffolding with auto-nav-insertion.

9. **`tangly eject`** — materialize the synthesized Astro project.

10. **Second theme: Pith** — different aesthetic, same component contract. Switching themes is just `"theme": "pith"`.

11. **`--tunnel` flag** — cloudflared download + quick tunnel.

**Acceptance criteria:**

- [ ] Edit `docs.json` → browser reloads without restart, in under 250ms
- [ ] Drop `./components/Note.tsx` in a test project → all `<Note>` renders use the override
- [ ] `draft: true` page invisible in `tangly build` output, visible in `tangly dev`
- [ ] `_section.mdx` cascades work; page frontmatter overrides
- [ ] Custom template resolves from `./templates/landing.astro`; missing template falls back with a warning
- [ ] `tangly.config.ts` Zod schemas validate at build time; bad data fails the build with a clear error
- [ ] `tangly upgrade` on a real Mintlify project produces a working `docs.json`
- [ ] Switching `"theme": "pith"` renders the same content with the second theme, no other changes
- [ ] `--tunnel` produces a working public URL

---

### Phase 3 — OpenAPI (2–3 days)

**Goal:** Auto-generated API reference pages that look good and stay in sync.

Tasks:

1. Detect `openapi` field on nav nodes; auto-generate a page for each endpoint
2. Allow manual MDX pages with `api: "POST /users"` frontmatter to override or augment auto-generated ones
3. Embed Scalar by default. Add Stoplight and Redoc as opt-in viewers.
4. Lazy-load viewer bundles — only the chosen one ships per page
5. Companion MDX: narrative content lives in a same-named MDX file next to the auto-generated route

**Acceptance criteria:**

- [ ] An OpenAPI 3.1 spec produces correctly grouped endpoint pages
- [ ] Try-it-out works for a real endpoint
- [ ] Switching `"viewer": "redoc"` swaps the renderer with no other changes
- [ ] Companion MDX appears above the generated playground

---

### Phase 4 — Search (2–3 days)

**Goal:** Cmd+K search that just works, zero infra.

Tasks:

1. Pagefind integration at build time — index every rendered page
2. Default `<SearchModal>` component in both themes; bind Cmd+K / Ctrl+K
3. Search excludes drafts and `noindex` pages
4. Highlight matches in result snippets
5. Configurable result limit and fuzzy threshold via `docs.json` `search` field

**Acceptance criteria:**

- [ ] Cmd+K opens the search modal anywhere in the docs
- [ ] Typing returns results within 50ms
- [ ] Results respect drafts and `noindex`
- [ ] Production bundle includes Pagefind's static index, served from CDN

---

### Phase 5 — Embedded Blocks (1–2 days)

**Goal:** `<Embed page="..." block="..." />` for keeping shared content in sync.

Tasks:

1. Heading IDs auto-generated from text; explicit `{#custom-id}` markers supported
2. `<Embed>` component resolves at build time
3. Circular embed detection → build error
4. Source page change re-renders all embedding pages

**Acceptance criteria:**

- [ ] Two pages can embed the same block; updating the source updates both renders
- [ ] Circular embed produces a clear build error pointing at both files
- [ ] Embedded content carries its own anchor link back to the source

---

### Phase 6 — AI Chat (3–5 days, optional)

**Goal:** Ask questions, get answers grounded in the docs. BYO API key.

Tasks:

1. Build-time embedding generation for every page chunk; index stored as static JSON or in Cloudflare Vectorize / R2
2. Default `<AiChat>` component, slide-over panel
3. Streaming endpoint at `/api/chat` — single Astro endpoint, runs on the chosen adapter
4. Config in `docs.json`:
   ```json
   "ai": {
     "provider": "anthropic",
     "model": "claude-sonnet-4-7",
     "apiKeyEnv": "ANTHROPIC_API_KEY"
   }
   ```
5. Per-page `aiContext` frontmatter merged with retrieved chunks before the model call
6. Conversation logged to localStorage by default; optional webhook for analytics

**Acceptance criteria:**

- [ ] Chat answers basic questions about a 100-page test corpus correctly
- [ ] Streaming response within 800ms first token on a fast connection
- [ ] Switching providers (anthropic ↔ openai) works via config
- [ ] Worker bundle stays under 1MB on Cloudflare

---

### Phase 7 — Versioning + i18n (3–4 days, lower priority)

**Goal:** Multi-version and multi-language docs without duplicating the entire tree.

Tasks:

1. Resolve URL strategy from nav structure (versions outside i18n → `/v2/es/...`; i18n outside versions → `/es/v2/...`)
2. Version overrides: `pages/billing.mdx` is base, `pages/billing.v2.mdx` overrides for v2
3. Version dropdown + language switcher components in both themes
4. Sitemaps + hreflang tags
5. Default version selection, with cookie-based persistence

**Acceptance criteria:**

- [ ] Two versions of the same page render at different URLs
- [ ] `pages/foo.mdx` and `pages/foo.v2.mdx` both work; v1 unaffected
- [ ] Language switcher swaps URL preserving the page
- [ ] hreflang tags point to translated counterparts

---

## 10. Testing Strategy

### Unit

Vitest in each package. Aim for 80%+ on `@tangly/schema` and the manifest builder — these are the foundations everything else depends on.

### Parity tests

The `tests/parity/` suite renders the Mintlify docs corpus through Tangly and compares against snapshots taken from mintlify.com/docs. Snapshots are HTML structure (not pixels) — we don't expect identical visuals, we expect identical content fidelity.

A parity test is:

1. Take a Mintlify MDX page
2. Render through Tangly
3. Assert that all components, links, and headings match expected structure

When something fails here, default to making Tangly match Mintlify unless we have an explicit reason to diverge.

### Visual regression

Playwright + Percy (or Chromatic) on a fixed corpus of fixture pages. Run on PR. Flag visual drift in the default theme.

### E2E

Playwright runs `tangly dev` and `tangly build` against `examples/basic/` on every PR. Verifies dev server starts, page loads, build artifacts are correct shape.

### Real-world validation

After each phase, port one of Nik's projects to Tangly and document the experience in `tests/REAL_WORLD.md`. This is the most important test — does the tool actually feel good to use?

Suggested order:

1. Phase 1 — port **SquirrelScan** (largest, most components used)
2. Phase 2 — port **FormShield** (smaller, exercises the new authoring features)
3. Phase 3 — port **ContentKong** (has API surface, tests OpenAPI)

---

## 11. Editor Integration

Publish a JSON Schema for `docs.json` to a stable URL once we have a domain. Until then, ship it bundled in the npm package and point users at the local file.

Users add this to the top of their `docs.json`:

```json
{
  "$schema": "https://tangly.dev/docs.json"
}
```

VS Code, Cursor, JetBrains all pick this up automatically and provide autocomplete + hover docs + inline validation.

This is the single highest-leverage DX investment. Do it in Phase 1.

---

## 12. Working Style for Claude Code

- **Read this whole document before writing code.** Then re-read the current phase before each work session.
- **Commit per task.** Each numbered task in a phase is one commit, with a clear message.
- **Open a PR per phase.** Don't merge until all acceptance criteria pass.
- **Update `tests/REAL_WORLD.md` as you go.** Every friction point you hit while porting a real project is a future GitHub issue.
- **When in doubt, do what Mintlify does.** Compatibility is the headline feature; clever divergences hurt more than they help.
- **Ask the human before adding dependencies.** Stack is locked in §2 for a reason.
- **No premature abstraction.** Two themes is enough to learn the right shape; don't generalize for theme #3 yet.
- **Performance budgets are real.** Cold start <2s and build <30s for 100 pages are not aspirational — they're acceptance criteria. Profile before merging if anything feels slow.

---

## 13. Open Questions (Resolve Before Phase 1)

These need a decision but aren't blocking the spec. Bring them up after reading.

1. Should `tangly` ship as a single npm package or a metapackage that pulls in `@tangly/core` + a theme? Single package is simpler; metapackage is cleaner long-term.
2. Tailwind v4 inside themes — yes? Or hand-rolled CSS variables only? Tailwind v4 is fast and the JIT keeps bundles small, but it's another dependency the user might fight if they eject.
3. Default font stack — system fonts only (zero network), or load Inter + Spectral from Google Fonts (or self-hosted)? Mintlify ships Inter; matching helps parity, but system fonts are faster.
4. Where does `tangly.config.ts` live in the user's project — root, or `.tangly/config.ts`? Root is more discoverable; `.tangly/` keeps the project root clean.
5. When the user has both `mint.json` and `docs.json`, which wins? Lean toward `docs.json` with a warning.

---

## 14. North Star Reminder

The win condition is: a real human (Nik, then anyone else) can move a Mintlify project to Tangly in under 30 minutes, deploy it, and feel good about the result. Everything else is in service of that.
