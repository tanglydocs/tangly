<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanglydocs/tangly/main/docs/images/tangly-logo-light.png">
    <img src="https://raw.githubusercontent.com/tanglydocs/tangly/main/docs/images/tangly-logo.png" alt="Tangly" width="320">
  </picture>
</p>

<p align="center">
  <strong>Markdown in. Beautiful docs out.</strong><br>
  Self-hosted, open-source documentation framework.
</p>

<p align="center">
  <a href="https://tangly.dev">website</a> ·
  <a href="https://docs.tangly.dev">docs</a> ·
  <a href="https://docs.tangly.dev/changelog">changelog</a> ·
  <a href="https://examples.tangly.dev">examples</a> ·
  <a href="https://www.npmjs.com/package/tangly">npm</a> ·
  <a href="https://github.com/tanglydocs/tangly">GitHub</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tangly"><img src="https://img.shields.io/npm/v/tangly?color=ea580c&label=npm" alt="npm version"></a>
  <a href="https://github.com/tanglydocs/tangly"><img src="https://img.shields.io/github/stars/tanglydocs/tangly?color=ea580c&logo=github&label=stars" alt="GitHub stars"></a>
  <a href="https://github.com/tanglydocs/tangly/actions/workflows/ci.yml"><img src="https://github.com/tanglydocs/tangly/actions/workflows/ci.yml/badge.svg?branch=main" alt="build status"></a>
  <a href="https://github.com/tanglydocs/tangly/actions/workflows/ci.yml"><img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nc9/e57cc6d614485c741294a2e7b5073890/raw/coverage.json" alt="coverage"></a>
  <a href="https://www.npmjs.com/package/tangly"><img src="https://img.shields.io/npm/dm/tangly?color=ea580c&label=downloads" alt="downloads/month"></a>
  <a href="https://github.com/tanglydocs/tangly/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/tangly?color=6b6b70" alt="MIT license"></a>
</p>

---

Tangly turns a folder of Markdown into a fast, themed, deployable docs site. It renders existing `docs.json` + MDX corpora **unmodified**: point it at a Mintlify-shaped project and it just works. Built on Astro 6, no proprietary backend, no vendor lock-in.

## Features

- **Self-hosted and open source.** A static site you own, hosted anywhere: Vercel, Cloudflare Pages, Netlify, AWS, GitHub Pages, S3, nginx. No proprietary backend, no monthly bill.
- **Drop-in Mintlify compatible.** Point Tangly at an existing `docs.json` + MDX project and it renders unchanged. `tangly migrate` converts a `mint.json` in one command. No source edits.
- **Auto-generated API docs.** Point at an OpenAPI 3.0 / 3.1 spec and get browseable endpoint pages with an interactive try-it panel. Redoc, Scalar, and Stoplight viewers too.
- **38 MDX components, no imports.** Cards, Tabs, Steps, Accordions, callouts, ParamFields, CodeGroups, and more. Every theme ships every one.
- **Code, math, and diagrams.** Shiki syntax highlighting with line highlights, diffs, focus, and titles. Mermaid diagrams. KaTeX math. Multi-language CodeGroups and package-manager tabs.
- **Built for AI agents.** Every page is also served as raw Markdown (`.md` URL or `Accept: text/markdown`). About 10× token reduction. `/llms.txt` and `/llms-full.txt` ship by default.
- **Five themes, or your own.** `tang`, `pith`, `pip`, `readable`, `geist` via one `theme` field. Build custom themes from `@tanglydocs/theme-ui`. [Live demos](https://examples.tangly.dev).
- **Search built in.** Pagefind, instant, ⌘K. No Algolia key, no third-party request.
- **Social cards, generated.** Every page gets a branded 1200×630 Open Graph image built from its title, theme, and your colors. Links unfurl instead of rendering blank. Per-environment URLs keep PR previews out of search.
- **Custom components.** Drop an `.astro` component into `components/` and use it from MDX. Hot-reloads, no registration.
- **Drafts.** Mark a page `draft: true`. Hidden in production, visible in `tangly dev`, shippable with `--include-drafts`.
- **Readable config errors.** `tangly check` reports problems key-by-key with line numbers, plain-English reasons, and did-you-mean fixes.
- **Fast dev, ejectable.** Astro 6 + Vite under the hood: HMR under 250ms, cold start under 2s on a hundred pages. `tangly eject` to a raw Astro project whenever you outgrow the magic.

## Install

```bash
# Install globally
npm i -g tangly

# Or run once without installing
bunx tangly init
npx tangly init

# Or add as a project dep
bun add tangly
npm install tangly
```

For a pinned version: `bunx tangly@0.1.0 init`. For the bleeding-edge build off `main`: `bun add tangly@dev`.

### Curl one-liner (alternative)

```bash
# Linux / macOS
curl -fsSL https://tangly.dev/install.sh | bash

# Windows (PowerShell)
iwr -useb https://tangly.dev/install.ps1 | iex
```

The curl installer picks the right package manager and writes a `tangly` wrapper to your `PATH`. Same end-state as `npm i -g tangly`; useful if you don't want a global npm install.

> **Why no standalone binary?** Tangly drives Astro at build time, and Astro's plugin ecosystem (Vite, Tailwind native bindings, MDX, Shiki) requires real on-disk `node_modules`. A single executable can't ship a working plugin tree, so the installer wraps `bunx`/`npx` instead.

## Quick start

```bash
tangly init my-docs        # scaffold a new project
cd my-docs
tangly dev                 # local dev server on :4322
tangly build               # static build → ./dist
```

That's it. `./dist/` is a static site you can host anywhere.

## CLI

| Command          | What                                                              |
|------------------|-------------------------------------------------------------------|
| `tangly init`    | Scaffold a new project from a template (`--template`, default `starter`). |
| `tangly dev`     | Local dev server with hot reload (default port 4322).             |
| `tangly build`   | Build to a static directory (`--out ./dist`, `--base /sub/`).     |
| `tangly preview` | Serve a built `dist/` locally for QA.                             |
| `tangly check`   | Validate `docs.json` + frontmatter (`--strict` for CI).           |
| `tangly migrate` | Convert a Mintlify `mint.json` project to a Tangly `docs.json`.   |
| `tangly add`     | Add a theme or component to an existing project.                  |
| `tangly eject`   | Materialise the synthesised Astro project into your repo. One-way. |

Full reference: [`docs.tangly.dev/reference/cli`](https://docs.tangly.dev/reference/cli).

## Configuration

Drop a `docs.json` at the project root:

```json
{
  "$schema": "https://tangly.dev/schema/docs.json",
  "name": "My Docs",
  "theme": "tang",
  "navigation": {
    "tabs": [
      { "tab": "Documentation", "groups": [
        { "group": "Get Started", "pages": ["introduction", "quickstart"] }
      ]}
    ]
  }
}
```

Every Mintlify field is supported. Full schema: [`docs.tangly.dev/reference/schema/docs-json`](https://docs.tangly.dev/reference/schema/docs-json).

## Migrating from Mintlify

```bash
tangly migrate             # reads mint.json, emits docs.json. MDX is untouched.
tangly dev                 # render with Tangly
```

If something doesn't render the way Mintlify did, file an issue. Tangly aims for parity. See the [Mintlify migration guide](https://docs.tangly.dev/guides/migration/from-mintlify) and [compatibility notes](https://docs.tangly.dev/guides/migration/compatibility).

## Deploy

```bash
tangly build --out ./dist  # produce a static folder

# then:
vercel deploy ./dist
wrangler pages deploy ./dist
netlify deploy --prod --dir dist
```

GitHub Pages, S3, nginx, Cloudflare Workers Sites: anything that serves files works. Subpath hosting via `--base /docs/`. See the [deploy guide](https://docs.tangly.dev/guides/deploying).

## Agent skills

Tangly ships two agent skills (Claude Code, Codex, and other skill-aware agents):

- **`tangly`**: use Tangly from an agent. Init, validate, structure docs, port from Mintlify, deploy.
- **`tech-documentation`**: write good technical docs (Diátaxis-grounded).

Install both globally:

```bash
npx skills add tanglydocs/tangly -g
```

The skills are version-locked to the CLI. When a flag changes, the skill content moves with it. See [`docs.tangly.dev/guides/ai-agents/skills`](https://docs.tangly.dev/guides/ai-agents/skills).

## Examples

Six live demos: one per theme, plus the default `tangly init` scaffold. Each is a real Tangly project rendering its own `docs.json` + MDX:

- [`tang`](https://examples.tangly.dev/tang/): Cipher (encryption SDK docs)
- [`pith`](https://examples.tangly.dev/pith/): On Craft (handbook)
- [`pip`](https://examples.tangly.dev/pip/): Sprig (tiny CLI docs)
- [`readable`](https://examples.tangly.dev/readable/): The Long Wait (short novel)
- [`geist`](https://examples.tangly.dev/geist/): Halo (edge platform docs)
- [`starter`](https://examples.tangly.dev/starter/): the default `tangly init` scaffold

Source under [`examples/`](https://github.com/tanglydocs/tangly/tree/main/examples) in the repo.

## Links

- **Docs**: [docs.tangly.dev](https://docs.tangly.dev)
- **Website**: [tangly.dev](https://tangly.dev)
- **Source**: [github.com/tanglydocs/tangly](https://github.com/tanglydocs/tangly)
- **Issues**: [github.com/tanglydocs/tangly/issues](https://github.com/tanglydocs/tangly/issues)
- **Changelog**: [docs.tangly.dev/changelog](https://docs.tangly.dev/changelog)

## License

[MIT](https://github.com/tanglydocs/tangly/blob/main/LICENSE) © 2026 Nik Cubrilovic
