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
  <a href="https://examples.tangly.dev">examples</a> ·
  <a href="https://github.com/tanglydocs/tangly">GitHub</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tangly"><img alt="npm" src="https://img.shields.io/npm/v/tangly?color=ea580c&label=tangly"></a>
  <a href="https://github.com/tanglydocs/tangly/blob/main/LICENSE"><img alt="MIT" src="https://img.shields.io/npm/l/tangly?color=6b6b70"></a>
  <a href="https://github.com/tanglydocs/tangly"><img alt="GitHub stars" src="https://img.shields.io/github/stars/tanglydocs/tangly?color=ea580c&logo=github&label=star"></a>
</p>

---

Tangly turns a folder of Markdown into a fast, themed, deployable docs site. It renders existing `docs.json` + MDX corpora **unmodified** — point it at a Mintlify-shaped project and it just works. Built on Astro 6, no proprietary backend, no vendor lock-in.

## Features

- **Host anywhere** — static builds you can drop on Vercel, Cloudflare Pages, Netlify, GitHub Pages, S3, nginx. No runtime, no Node process.
- **Built on Astro** — produces a real Astro site you can `tangly eject` and own outright.
- **Drop-in Mintlify compat** — point Tangly at an existing `docs.json` + MDX project. No source edits.
- **Six themes** — `tang`, `pith`, `pip`, `readable`, `geist`, `starter`. One field swap, no component changes. [Live demos →](https://examples.tangly.dev)
- **34 MDX components** built in — Cards, Tabs, Steps, Accordions, ParamFields, CodeGroups, Mermaid, KaTeX, OpenAPI try-it. No imports.
- **Built for AI agents** — every page is also served as raw Markdown (`.md` URL or `Accept: text/markdown`). ~10× token reduction. `/llms.txt` and `/llms-full.txt` ship by default.
- **OpenAPI 3.0 / 3.1** — point at a spec, get browseable endpoint pages with a try-it panel.
- **Pagefind search** — instant, ⌘K, no Algolia key.
- **One-line migration** from Mintlify — `tangly migrate` reads `mint.json`, emits a Tangly-shaped `docs.json`. MDX stays untouched.

## Install

The fastest install — a curl-installer that picks the right package manager and writes a `tangly` wrapper to your `PATH`:

```bash
# Linux / macOS
curl -fsSL https://tangly.dev/install.sh | bash

# Windows (PowerShell)
iwr -useb https://tangly.dev/install.ps1 | iex
```

Or use a package manager directly:

```bash
# Run latest, no install
bunx tangly init
npx tangly init

# Install globally
npm i -g tangly

# Add as a project dep
bun add tangly
npm install tangly
```

For a pinned version: `bunx tangly@0.1.0 init`. For the bleeding-edge build off `main`: `bun add tangly@dev`.

> **Why no standalone binary?** Tangly drives Astro at build time, and Astro's plugin ecosystem (Vite, Tailwind native bindings, MDX, Shiki) requires real on-disk `node_modules`. A single executable can't ship a working plugin tree, so the installer wraps `bunx`/`npx` instead.

## Quick start

```bash
tangly init my-docs        # scaffold a new project
cd my-docs
tangly dev                 # local dev server on :4322
tangly build               # static build → ./dist
```

That's it — `./dist/` is a static site you can host anywhere.

## CLI

| Command          | What                                                              |
|------------------|-------------------------------------------------------------------|
| `tangly init`    | Scaffold a new project from a template (`--theme tang/pith/…`).   |
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

If something doesn't render the way Mintlify did, file an issue — Tangly aims for parity. See the [Mintlify migration guide](https://docs.tangly.dev/guides/migration/from-mintlify) and [compatibility notes](https://docs.tangly.dev/guides/migration/compatibility).

## Deploy

```bash
tangly build --out ./dist  # produce a static folder

# then:
vercel deploy ./dist
wrangler pages deploy ./dist
netlify deploy --prod --dir dist
```

GitHub Pages, S3, nginx, Cloudflare Workers Sites — anything that serves files works. Subpath hosting via `--base /docs/`. See the [deploy guide](https://docs.tangly.dev/guides/deploying).

## Agent skills

Tangly ships two Claude-Code-compatible skills:

- **`tanglify`** — use Tangly from an agent: init, validate, structure docs, port from Mintlify, deploy.
- **`tech-documentation`** — write good technical docs (Diátaxis-grounded).

Install both globally:

```bash
npx skills add tanglydocs/tangly -g
```

The skills are version-locked to the CLI — when a flag changes, the skill content moves with it. See [`docs.tangly.dev/guides/ai-agents/skills`](https://docs.tangly.dev/guides/ai-agents/skills).

## Examples

Six live demos, one per theme — each is a real Tangly project rendering its own `docs.json` + MDX:

- [`tang`](https://examples.tangly.dev/tang/) — Cipher (encryption SDK docs)
- [`pith`](https://examples.tangly.dev/pith/) — On Craft (handbook)
- [`pip`](https://examples.tangly.dev/pip/) — Sprig (tiny CLI docs)
- [`readable`](https://examples.tangly.dev/readable/) — The Long Wait (short novel)
- [`geist`](https://examples.tangly.dev/geist/) — Halo (edge platform docs)
- [`starter`](https://examples.tangly.dev/starter/) — the default `tangly init` scaffold

Source under [`examples/`](https://github.com/tanglydocs/tangly/tree/main/examples) in the repo.

## Links

- **Docs** — [docs.tangly.dev](https://docs.tangly.dev)
- **Website** — [tangly.dev](https://tangly.dev)
- **Source** — [github.com/tanglydocs/tangly](https://github.com/tanglydocs/tangly)
- **Issues** — [github.com/tanglydocs/tangly/issues](https://github.com/tanglydocs/tangly/issues)
- **Changelog** — [github.com/tanglydocs/tangly/releases](https://github.com/tanglydocs/tangly/releases)

## License

[MIT](https://github.com/tanglydocs/tangly/blob/main/LICENSE) © 2026 Nik Cubrilovic
