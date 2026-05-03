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
  <a href="https://examples.tangly.dev">examples</a> ·
  <a href="https://www.npmjs.com/package/tangly">npm</a>
</p>

## Features

- **Host anywhere** - Static builds you can host anywhere (Vercel, Cloudflare, Netflify, AWS)
- **Built on Astro** - Builds an [astro](https://astro.builds) site you can eject 
- **Drop-in Mintlify compat** - point Tangly at an existing `docs.json` + MDX project. No source edits.
- **Six themes** - `tang`, `pith`, `pip`, `readable`, `geist`, `starter`. One field swap, no component changes. [Live demos →](https://examples.tangly.dev)
- **34 MDX components** built in: Cards, Tabs, Steps, Accordions, ParamFields, CodeGroups, Mermaid, KaTeX, OpenAPI try-it. No imports.
- **Built for AI agents** - every page is also served as raw Markdown (`.md` URL or `Accept: text/markdown`). ~10× token reduction. `/llms.txt` and `/llms-full.txt` ship by default.
- **OpenAPI 3.0 / 3.1** - point at a spec, get browseable endpoint pages with try-it.
- **Static output** - `tangly build` emits a folder. Drop it on Vercel, Cloudflare Pages, Netlify, GitHub Pages, S3, nginx. No runtime.
- **Pagefind search** built in — instant, ⌘K, no Algolia key.
- **Custom themes** - build custom themes using components from `@tanglydocs/theme-ui`
- **One-line migration** from Mintlify — `tangly migrate` reads `mint.json`, emits a Tangly-shaped `docs.json`. MDX stays untouched.

## Install

Linux / macOS

```bash
curl -fsSL https://tangly.dev/install.sh | bash
```

Windows (PowerShell)

```bash
iwr -useb https://tangly.dev/install.ps1 | iex
```

or install globally via npm 

```bash
npm i -g tangly
```

one-off run latest 

```bash
npx tangly init
```

Then:

```bash
tangly init my-docs
cd my-docs
tangly dev
```

Full install paths in [`packages/tangly/README.md`](packages/tangly/README.md#install).

## Quick links

- [Documentation](https://docs.tangly.dev) — guides, schema reference, CLI reference
- [Website](https://tangly.dev)
- [Theme demos](https://examples.tangly.dev) — see every theme rendering a real project
- [Mintlify migration guide](https://docs.tangly.dev/guides/migration/from-mintlify)
- [Deploy guide](https://docs.tangly.dev/guides/deploying)

## Agent skills

Tangly ships two Agent skills under [`skills/`](skills):

- [`tanglify`](skills/tanglify) — use Tangly: init, verify, structure docs, port from Mintlify, deploy.
- [`tech-documentation`](skills/tech-documentation) — write good technical docs (Diátaxis-grounded).

```bash
npx skills add tanglydocs/tangly -g
```

## Repo

| Path                       | What                                              |
|----------------------------|---------------------------------------------------|
| `packages/tangly`          | the `tangly` CLI + manifest + Vite plugin         |
| `packages/schema`          | `@tanglydocs/schema` — Zod + JSON Schema          |
| `packages/theme-ui`        | shared MDX components                             |
| `packages/theme-{tang,pith,pip,readable,geist}` | the six themes                |
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

MIT
