<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/tangly-logo-light.png">
    <img src="docs/images/tangly-logo.png" alt="Tangly" width="320">
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
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/tangly?color=6b6b70" alt="MIT license"></a>
</p>

## Features

- **Fast dev server.** Astro 6 + Vite. HMR under 250ms. Cold start under 2s on a hundred pages.
- **Host anywhere.** Static builds you drop on Vercel, Cloudflare, Netlify, AWS, GitHub Pages, S3, nginx. No runtime.
- **Built on Astro.** Builds an [Astro](https://astro.build) site you can eject.
- **Drop-in Mintlify compat.** Point Tangly at an existing `docs.json` + MDX project. No source edits.
- **Five themes.** `tang`, `pith`, `pip`, `readable`, `geist`. One `theme` field in `docs.json`, no component changes. See [live demos](https://examples.tangly.dev).
- **38 MDX components** built in: Cards, Tabs, Steps, Accordions, ParamFields, CodeGroups, Mermaid, KaTeX, OpenAPI try-it. No imports.
- **Built for AI agents.** Every page is also served as raw Markdown (`.md` URL or `Accept: text/markdown`). About 10× token reduction. `/llms.txt` and `/llms-full.txt` ship by default.
- **OpenAPI 3.0 / 3.1.** Point at a spec, get browseable endpoint pages with try-it.
- **Static output.** `tangly build` emits a folder. No runtime.
- **Pagefind search built in.** Instant, ⌘K, no Algolia key.
- **Social cards, generated.** Every page gets a branded 1200×630 Open Graph image built from its title, theme, and your colors. Links unfurl instead of rendering blank. Per-environment URLs mean PR previews self-reference and stay out of search.
- **Custom themes.** Build them using components from `@tanglydocs/theme-ui`.
- **One-line migration from Mintlify.** `tangly migrate` reads `mint.json`, emits a Tangly-shaped `docs.json`. MDX stays untouched.

## Install

```bash
npm i -g tangly
```

Or run once without installing:

```bash
npx tangly init
bunx tangly init
```

Then:

```bash
tangly init my-docs
cd my-docs
tangly dev
```

### Curl one-liner (alternative)

```bash
# Linux / macOS
curl -fsSL https://tangly.dev/install.sh | bash

# Windows (PowerShell)
iwr -useb https://tangly.dev/install.ps1 | iex
```

Full install paths in [`packages/tangly/README.md`](packages/tangly/README.md#install).

## Quick links

- [Documentation](https://docs.tangly.dev): guides, schema reference, CLI reference
- [Changelog](https://docs.tangly.dev/changelog): release notes, newest first
- [Website](https://tangly.dev)
- [Theme demos](https://examples.tangly.dev): every theme rendering a real project
- [Mintlify migration guide](https://docs.tangly.dev/guides/migration/from-mintlify)
- [Deploy guide](https://docs.tangly.dev/guides/deploying)

## Agent skills

Tangly ships two Agent skills under [`skills/`](skills):

- [`tangly`](skills/tangly): use Tangly: init, verify, structure docs, port from Mintlify, deploy.
- [`tech-documentation`](skills/tech-documentation): write good technical docs (Diátaxis-grounded).

```bash
npx skills add tanglydocs/tangly -g
```

## Repo

| Path                       | What                                              |
|----------------------------|---------------------------------------------------|
| `packages/tangly`          | the `tangly` CLI + manifest + Vite plugin         |
| `packages/schema`          | `@tanglydocs/schema`: Zod + JSON Schema           |
| `packages/theme-ui`        | shared MDX components                             |
| `packages/theme-{tang,pith,pip,readable,geist}` | the five themes               |
| `packages/template-*`      | `tangly init` templates                           |
| `packages/website`         | source for [`tangly.dev`](https://tangly.dev)     |
| `docs/`                    | source for [`docs.tangly.dev`](https://docs.tangly.dev) (rendered by Tangly itself) |
| `examples/demo-*`          | per-theme corpora powering [`examples.tangly.dev`](https://examples.tangly.dev) |
| `tests/parity/`            | Mintlify parity tests                             |
| `install.sh`, `install.ps1`| curl-installer scripts                            |

## Develop

```bash
bun install
bun run --parallel format:check lint typecheck
bun run dev:docs            # serve docs/ at :4322
```

Smoke-test the published tarball against a clean install:

```bash
bun run scripts/smoke-tarball.ts
```

## License

[MIT](LICENSE) © 2026 Nik Cubrilovic
