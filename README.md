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

- **Self-hosted and open source.** A static site you own, hosted anywhere: Vercel, Cloudflare, Netlify, AWS, GitHub Pages, S3, nginx. No proprietary backend, no monthly bill.
- **Drop-in Mintlify compatible.** Point Tangly at an existing `docs.json` + MDX project and it renders unchanged. `tangly migrate` converts a `mint.json` in one command. No source edits.
- **Auto-generated API docs.** Point at an OpenAPI 3.0 / 3.1 spec and get browseable endpoint pages with an interactive try-it panel. Redoc, Scalar, and Stoplight viewers too.
- **38 MDX components, no imports.** Cards, Tabs, Steps, Accordions, callouts, ParamFields, CodeGroups, and more. Every theme ships every one.
- **Code, math, and diagrams.** Shiki syntax highlighting with line highlights, diffs, focus, and titles. Mermaid diagrams. KaTeX math. Multi-language CodeGroups and package-manager tabs.
- **Built for AI agents.** Every page is also served as raw Markdown (`.md` URL or `Accept: text/markdown`). About 10× token reduction. `/llms.txt` and `/llms-full.txt` ship by default.
- **Five themes, or your own.** `tang`, `pith`, `pip`, `readable`, `geist` via one `theme` field. Build custom themes from `@tanglydocs/theme-ui`. See [live demos](https://examples.tangly.dev).
- **Search built in.** Pagefind, instant, ⌘K. No Algolia key, no third-party request.
- **Social cards, generated.** Every page gets a branded 1200×630 Open Graph image built from its title, theme, and your colors. Links unfurl instead of rendering blank. Per-environment URLs keep PR previews out of search.
- **Custom components.** Drop an `.astro` component into `components/` and use it from MDX. Hot-reloads, no registration.
- **Drafts.** Mark a page `draft: true`. Hidden in production, visible in `tangly dev`, shippable with `--include-drafts`.
- **Readable config errors.** `tangly check` reports problems key-by-key with line numbers, plain-English reasons, and did-you-mean fixes.
- **Fast dev, ejectable.** Astro 6 + Vite under the hood: HMR under 250ms, cold start under 2s on a hundred pages. `tangly eject` to a raw Astro project whenever you outgrow the magic.

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
