---
name: tangly
description: |
  Build, customize, and ship documentation sites with Tangly — a self-hosted,
  open-source documentation framework that renders Mintlify projects unmodified.
  Covers initializing a documentation project, validating with `tangly check`,
  authoring docs.json + MDX content, porting an existing Mintlify docs site via
  `tangly migrate`, and deploying static output to Vercel, Cloudflare Pages,
  Netlify, or any CDN (including subpath hosting via --base).

  Apply when: working in a Tangly documentation repo; building, scaffolding, or
  editing a docs site; running any `tangly` CLI command (init, dev, build,
  preview, check, migrate, add, eject); editing docs.json or MDX frontmatter;
  migrating documentation from Mintlify or mint.json; deploying a documentation
  site to production. Trigger keywords: tangly, docs.json, mintlify,
  documentation site, docs framework, mdx docs, static docs.
license: MIT
compatibility: Designed for Claude Code and other agent-skills clients. Requires Node 20+ or Bun 1.2+.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
metadata:
  author: tanglydocs
  version: 0.1.2
  category: documentation
  tags: tangly, documentation, docs, mintlify, mdx, astro, static-site, site-generator, docs-as-code, openapi
  homepage: https://tangly.dev
  repository: https://github.com/tanglydocs/tangly
---

# tangly

Tangly is a self-hosted, OSS docs framework that renders Mintlify projects unmodified. One static `dist/` ships to any CDN. This skill is a fast reference for using it.

## When to use

Trigger on any of:
- The user mentions `tangly`, `docs.json`, or a Tangly repo.
- Scaffolding or editing docs (init, page add, navigation, frontmatter).
- Migrating from Mintlify (`mint.json` → `docs.json`).
- Building, previewing, or deploying a docs site (Vercel/Cloudflare/Netlify/static; subpath hosting).
- The user shares a `docs.json` and asks how to validate/extend it.

## Tooling

`bun` only. Never use `npm`/`pnpm`/`yarn`. CLI is invoked as `bun x tangly <cmd>` (or `tangly <cmd>` if the dep is installed).

## Quick start

```bash
bun x tangly init           # interactive scaffold (basic | api template)
bun x tangly dev            # HMR dev server on :4321
bun x tangly check          # validate docs.json + nav + links + frontmatter
bun x tangly build          # static build → ./dist
bun x tangly preview        # serve ./dist locally
```

To bootstrap docs.json from an existing folder of `.md`/`.mdx` files:

```bash
bun x tangly init --from ./existing-docs
```

`--from` walks the tree (folders → groups), is idempotent, and merges new files into an existing nav on re-run.

## Project structure

```
docs.json              # config (required, project root)
introduction.mdx       # any *.mdx at any depth = a page
guides/
  getting-started.mdx
snippets/              # reusable MDX, included via <Snippet file="..." />
images/                # absolute /images/foo.png references
public/                # passthrough static assets
404.mdx, 500.mdx       # optional error templates (project root override)
.tanglyignore          # gitignore-syntax exclusions for the build copy step
```

Every `.mdx` is a page; the route is its path relative to the project root, slugified.

## CLI reference

Source of truth: `packages/tangly/src/cli/commands/*.ts`. Detailed pages: `docs/reference/cli/*.mdx`.

### `tangly init [dir]`
Scaffold a project. Interactive prompts for name + template (`basic` | `api`).
- `--from <path>` — walk an existing folder and synthesize `docs.json` (idempotent, merges).
- Refuses to overwrite an existing `docs.json` unless `--from` is given.

### `tangly dev`
HMR dev server. Pre-validates the manifest before launching Astro so schema errors surface early.
- `--port <n>` (default `4321`)
- `--host` — expose on LAN
- `--no-open` — don't open browser
- `--config <path>` — docs.json path (default `docs.json`)
- `--root <dir>` — project root (default `.`)
- `--debug` — verbose Astro logging
- `--tunnel` — cloudflared quick tunnel (prefer running tunnels via taskmux instead)

### `tangly build`
Production static build.
- `--out <dir>` (default `./dist`)
- `--adapter <vercel|cloudflare|node|static>` — auto-detected if omitted
- `--config <path>`, `--root <dir>`
- `--base <path>` — subpath like `/docs` (default `/`)
- `--analyze` — write a build-size report to `dist/_tangly/`

Outputs: prerendered HTML, per-page `<slug>.md` (raw source for AI agents — `.md` URL suffix or `Accept: text/markdown`), `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, Pagefind index under `_pagefind/`.

### `tangly preview`
Serve `./dist` locally to spot-check the build.
- `--port <n>` (default `4321`)
- `--out <dir>` (default `./dist`)
- `--root <dir>`

### `tangly check`
Validate config, navigation refs, links, images, frontmatter. Use in CI.
- `--strict` — warnings become errors (recommended in CI)
- `--no-links` — skip link checking
- `--json` — machine-readable output
- `--include-drafts` — also check drafts
- `--config <path>`, `--root <dir>`

Exit non-zero on errors.

### `tangly migrate [root]`
Migrate to Tangly. Two paths:
- `mint.json` present → full conversion via `convertMintToDocs`. Backs up `mint.json` to `mint.json.bak` (or `--keep-source` to leave it).
- `docs.json` present → validates + updates `$schema` URL to Tangly's. Theme left as-is; emits a notice if it isn't a Tangly theme.

Flags: `--yes` (skip prompts), `--keep-source`, `--root`.

Idempotent — safe to re-run.

### `tangly add <type> <path>`
Scaffold a page, snippet, or changelog entry.
- `<type>`: `page` | `snippet` | `changelog`
- `<path>`: slug, e.g. `guides/billing` (no `.mdx` extension)
- `--template <name>` — use a template from `./templates/`
- `--no-nav` — skip auto-insertion into `docs.json` (pages + changelog auto-insert into the last group)
- `--root <dir>`

### `tangly eject`
Materialize the synthesized Astro project and own it directly. Irreversible.
- `--out <dir>` (default `./.tangly`)
- `--yes` — skip confirmation
- `--root <dir>`

After eject: `bun install` then `bun run dev`. The materialized project still imports `tangly/plugin` and `@tanglydocs/theme-*` for components.

## `docs.json` essentials

Schema: `packages/schema/src/docs-json.ts`. Reference page: `docs/reference/schema/docs-json.mdx`.

Minimal valid config:

```json
{
  "$schema": "https://tangly.dev/schema/docs.json",
  "name": "My Docs",
  "theme": "tang",
  "colors": { "primary": "#0ea5e9" },
  "navigation": {
    "groups": [{ "group": "Get Started", "pages": ["introduction"] }]
  }
}
```

Top-level fields (most common):

| Field | Purpose |
| --- | --- |
| `name` (req) | Project name shown in navbar |
| `siteUrl` | Absolute site URL (e.g. `https://docs.example.com`). Enables canonical tags + auto social cards. |
| `theme` | `tang` (default), `pith`, `pip`, `readable`, `geist`. Mintlify aliases (mint/maple/palm/willow/linden/almond/aspen/luma/sequoia) tolerated, fall through to `tang`. |
| `colors` | `primary`, `light`, `dark` (hex) |
| `favicon` | string or `{ light, dark }` |
| `navigation` | `tabs[]` → `groups[]` → `pages[]` (recursive groups OK), or top-level `groups[]`/`pages[]`. Anchors, dropdowns, versions, languages all supported. |
| `navbar` | `links[]`, `primary` (button or github) |
| `footer` | `socials`, `links[]`, `lastUpdated`, `editUrl` (`{path}` template), `repo` (auto-derives `editUrl`) |
| `banner` | `id`, `type`, `dismissible`, `content` |
| `seo` | `metatags`, `indexing` (`all` \| `navigable`) |
| `thumbnails` | Auto social cards (OG images): `enabled`, `background`, `accent`, `image`. On by default once `siteUrl` set; prerendered to `/og/<slug>.png`. Per-page override via frontmatter `seo.ogImage`. |
| `redirects` | `[{ source, destination, permanent? }]` |
| `appearance` | default mode, reading time, reading progress |
| `search` | Pagefind config |
| `api`, `openapi` | global API/OpenAPI config |
| `integrations` | analytics (PostHog and others) |
| `fonts` | custom font config |
| `background` | hex/gradient background |

## Frontmatter

Schema: `packages/schema/src/frontmatter.ts`. Reference: `docs/reference/schema/frontmatter.mdx`.

```mdx
---
title: Billing
sidebarTitle: Billing
description: How invoicing works
icon: receipt
tag: New
draft: false
mode: wide                # default | wide | center | custom
template: custom-page      # path or name in templates/
openapi: openapi.json#/paths/~1users/get
keywords: [billing, invoices]
noindex: false
lastUpdated: 2026-04-29   # or false to hide
readingTime: false        # or a number to override
editUrl: https://github.com/...
glossary: false           # disable auto-link on this page
seo:
  title: Billing | My Docs
  description: ...
  ogImage: /og/billing.png
aiContext: short hint for AI consumers
---
```

`title` is technically optional — falls back to humanized slug at render time. `check` warns on missing.

## OpenAPI endpoint pages

Pages with `openapi:` (or `api:` for companion-narrative) frontmatter switch to the **split layout** automatically: docs column on the left, sticky right-rail playground panel on the right (xl+). Single-column fallback below xl.

What renders:

- Method bubble + path (color-coded GET/POST/PUT/PATCH/DELETE — matches the sidebar pill)
- Description
- **Parameter sections**: `Path`, `Query`, `Header`, `Cookie` (each row expandable; `api.params.expanded: "all"` opens by default)
- Request body schema tree (top-level fields)
- **Tabbed responses by status code** (200 / 4xx / 5xx with status-color dots; schema tree per tab)
- **Right-rail panel**: language tabs, `Send →` toggle, live response preview

Default code-sample languages: `["curl", "typescript", "python"]`. Override via `api.codeSamples.languages`. Built-in generators: `curl`, `bash`, `shell`, `typescript`/`ts`, `javascript`/`js`, `python`/`py`, `go`. Mintlify-style `api.examples.*` is normalized to `api.codeSamples.*` at parse time.

Per-endpoint custom samples: wrap fenced code blocks in `<RequestExample>` inside the endpoint MDX. The fence's language token (`ts`, `python`, `go`, …) replaces the same-language panel tab. Languages not in the configured list are silently ignored. Spec-side `x-codeSamples` (or `x-code-samples`) are also picked up automatically.

Precedence: `<RequestExample>` ▸ `x-codeSamples` ▸ autogen.

Hide endpoints from the sidebar with `x-hidden: true` (still URL-routable) or remove entirely with `x-excluded: true`.

Full reference: `docs/guides/authoring/openapi.mdx`.

## Components (built-in MDX, no import)

All 33 ship Mintlify-compatible names and render unmodified:

- Callouts: `Note`, `Tip`, `Warning`, `Info`, `Check`, `Danger`, `Update`
- Cards: `Card`, `CardGroup`, `Columns`
- Code: `CodeGroup` (tab labels via per-block `title`), `PackageManager` (npm/yarn/pnpm/bun), `Snippet`, `Kbd`
- Trees: `FileTree` — nested Markdown list → directory tree. `**bold**` highlights, trailing text becomes a comment, `...` is a placeholder. Variants: `default` (icons + card), `terminal` (dark bg + ASCII connectors, with `chrome` for window dots), `ascii` (plain ASCII connectors, no card). Use this instead of fenced ASCII trees.
- Tabs & Steps: `Tabs` + `Tab`, `Steps` + `Step`
- Layout: `Frame`, `Accordion` + `AccordionGroup`, `Expandable`
- API: `ParamField`, `ResponseField`, `RequestExample` (overrides panel tabs by language), `ResponseExample`, `OpenApiEndpoint` (split layout: docs left, sticky playground panel right at xl+), `OpenApiScalar`, `OpenApiRedoc`, `OpenApiStoplight`
- Media: `Embed` (cross-page block reuse), `Video` (YouTube/Vimeo/mp4 with lazy iframe), `LightboxImage` (auto-wraps every inline `<img>`)
- Text: `Badge` (status/version chip — `default`/`tip`/`warning`/`error`/`accent`, sizes `small`/`medium`/`large`; aliases `note`→`default`, `success`→`tip`, `caution`→`warning`, `danger`→`error`), `Icon` (Lucide + Font Awesome aliases + brand glyphs), `Tooltip`, `GlossaryTerm`

Full prop reference per family: `docs/reference/components/{callouts,cards,code,tabs-and-steps,layout,api,media,text}.mdx`.

## Markdown extras (syntax, not components)

Wired by default — no import:

- **LaTeX / KaTeX math** — inline `$…$`, block `$$…$$`, plus the Mintlify `<latex>…</latex>` shim. Renders at build time, no client JS. Reference: `docs/reference/markdown/index.mdx#latex`.
- **Mermaid diagrams** — fenced ```` ```mermaid ```` block. Flowchart/sequence/class/state/ER/gantt/etc. Mermaid lib is dynamically imported only on pages that contain a `pre.mermaid` element. Theme honors active light/dark + Tangly tang accent via `themeVariables`. Reference: `docs/reference/markdown/index.mdx#mermaid`.

## Themes

Five canonical themes in `TANGLY_THEMES`: `tang` (default, Mintlify-Mint-inspired), `pith` (editorial, serif headings), `pip`, `readable`, `geist`. Set in `docs.json`:

```json
{ "theme": "pith" }
```

Override theme components by dropping replacements into `theme/` at the project root — see `docs/guides/custom-components.mdx` for the resolution order.

## Port from Mintlify

```bash
bun x tangly migrate          # interactive
bun x tangly migrate --yes    # non-interactive
```

What it does:
1. Reads `mint.json`, runs `convertMintToDocs` → writes `docs.json`.
2. Renames `mint.json` → `mint.json.bak` (or keeps with `--keep-source`).
3. Sets `$schema` to `https://tangly.dev/schema/docs.json`.
4. Surfaces a notice if `theme` isn't one of `TANGLY_THEMES`.

Auto-handled at render time (no manual rewrite needed):
- `<latex>...</latex>` blocks → `$$...$$` before MDX parse.
- Relative Markdown image refs (`![](../images/foo.png)`) → absolute (`/images/foo.png`).

After migrate, `tangly dev` should render the Mintlify project unmodified. Run `tangly check --strict` to catch frontmatter warnings.

## Deploy

Adapter auto-detects from a signal file in the project root:

| Signal file | Adapter |
| --- | --- |
| `vercel.json` | `vercel` |
| `wrangler.toml` or `wrangler.jsonc` | `cloudflare` |
| `Dockerfile` | `node` |
| (none) | `static` |

Override with `--adapter`. All adapters today produce the same static `dist/` — `cloudflare`/`node` are recognized for forward-compat (SSR routes land later). Detailed config snippets: `docs/guides/deploying.mdx`.

### Vercel

```bash
bun x tangly build
vercel deploy ./dist
```

Or git-connected via `vercel.json`:
```json
{ "buildCommand": "bun x tangly build", "outputDirectory": "dist", "framework": null }
```

### Cloudflare Pages

```bash
bun x tangly build
bunx wrangler pages deploy ./dist --project-name my-docs
```

### Netlify

`netlify.toml`:
```toml
[build]
  command = "bun x tangly build"
  publish = "dist"
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Static (S3, R2, GitHub Pages, nginx)

`bun x tangly build`, then upload `dist/` anywhere.

### Subpath hosting

Build with `--base`:

```bash
bun x tangly build --base /docs
```

Five strategies (host the docs at `/docs` on an existing site): build-into-public, edge-rewrite (Vercel/Netlify rewrites), Cloudflare Worker proxy, nginx `location` blocks, GitHub Pages project repo. Full guide: `docs/guides/subpath-hosting.mdx`.

## Common workflows

| Goal | Command |
| --- | --- |
| New page in a group | `bun x tangly add page guides/foo` |
| Reusable snippet | `bun x tangly add snippet shared/disclaimer` |
| Changelog entry | `bun x tangly add changelog 1.2.0` |
| Wire OpenAPI to a page | Set `openapi:` in frontmatter (path or `file#/jsonpointer`) |
| Override panel code samples | Wrap fenced blocks in `<RequestExample>` inside the endpoint MDX |
| Configure code-sample languages | `api.codeSamples.languages: ["curl", "typescript", "python"]` in `docs.json` |
| Hide an endpoint from sidebar | `x-hidden: true` on the operation (still routable). `x-excluded: true` removes entirely. |
| Override a theme component | Drop replacement in `theme/` (see `docs/guides/custom-components.mdx`) |
| Hide a page from prod | `draft: true` in frontmatter |
| Show drafts in build | `TANGLY_INCLUDE_DRAFTS=1 bun x tangly build` |
| Validate in CI | `bun x tangly check --strict --json` |

## Gotchas

- **Frontmatter `title` is the page H1** — don't write `# Title` or `<h1>` in the body. `tangly dev` warns when it finds one. Use `## H2` for top-level sections.
- **Don't run `oxfmt` on `.mdx` / `.md` / `.astro`** — it mangles them. The repo's `.prettierignore` excludes them; keep it current.
- **Tailwind content scanner** — theme components must list `@source` in `theme.css`; the consuming project's scanner only auto-detects its own files.
- **Image optimization is disabled** — Mintlify projects use absolute URLs. Use `/images/foo.png`, not relative paths.
- **Drafts** — hidden in `build` unless `TANGLY_INCLUDE_DRAFTS=1`. Visible in `dev`.
- **Vite pinning** — root `package.json` pins Vite via `overrides` because Tailwind v4 pulls a newer Vite that conflicts with Astro's bundled version.
- **`tangly` is a CLI; `@tanglydocs/schema` is private** — the npm org `@tangly` was unavailable, so workspace pkgs use `@tanglydocs`.

## Reference (in-repo)

- CLI per-command: `docs/reference/cli/{init,dev,build,preview,check,migrate,add,eject}.mdx`
- Schema: `docs/reference/schema/{docs-json,frontmatter,themes,colors,icons}.mdx`
- Components: `docs/reference/components/{callouts,cards,tabs-and-steps,code,layout,api,media}.mdx`
- Guides: `docs/guides/*.mdx` — `configuration`, `navigation`, `components`, `themes`, `openapi`, `search`, `code-blocks`, `announcement`, `custom-components`, `custom-templates`, `drafts`, `embedded-blocks`, `glossary`, `static-assets`, `deploying`, `subpath-hosting`, `migrate-from-mintlify`
- Architecture: `docs/architecture/{overview,manifest,vite-plugin,runtime}.mdx`
- Spec: `plans/SPEC.md`
- Repo conventions: `CLAUDE.md`
