<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/logo/tangly-logo-light.png">
    <img src="./brand/logo/tangly-logo.png" alt="Tangly" width="320">
  </picture>
</p>

> **Markdown in. Beautiful docs out.**
>
> Tangly is an open-source documentation framework that turns a folder of markdown into a fast, themed site you self-host.

## Built for the agent era

Every page is also served as raw Markdown — append `.md` to any URL, or send `Accept: text/markdown`. ~10× token reduction vs. HTML. Coding assistants like Claude Code, OpenCode, and Cursor get the source, not the chrome. `/llms.txt` and `/llms-full.txt` ship out of the box. See [Markdown for agents](./docs/guides/ai-agents/markdown-for-agents.mdx).

## Install

```bash
# Linux / macOS
curl -fsSL https://tangly.dev/install.sh | bash

# Windows (PowerShell)
iwr -useb https://tangly.dev/install.ps1 | iex
```

Or use `bunx tangly init` / `npx tangly init` / `bun add tangly`. See
[`packages/tangly/README.md`](./packages/tangly/README.md#install) for all paths.

## Agent skills

Tangly ships two Claude Code skills under [`skills/`](./skills):

- [`tanglify`](./skills/tanglify) — use Tangly: init, verify, structure docs, port from Mintlify, deploy.
- [`tech-documentation`](./skills/tech-documentation) — write good technical docs (Diátaxis-grounded).

Install via the npm `skills` convention:

```bash
npx skills add tanglify
npx skills add tech-documentation
```

Or point at this repo directly:

```bash
npx skills add github:tanglydocs/tangly/skills/tanglify
npx skills add github:tanglydocs/tangly/skills/tech-documentation
```

## Goal

Render any existing Mintlify project (`docs.json` + `*.mdx`) without source edits. Build to a static site that drops onto Vercel or Cloudflare. Stay simple enough that one person can hold the whole codebase in their head.

See [`plans/SPEC.md`](./plans/SPEC.md) for the full brief.

## Repo

- `packages/tangly` — the npm package + CLI
- `packages/schema` — `@tanglydocs/schema` (Zod + JSON Schema for `docs.json`)
- `packages/theme-ui` — shared theme primitives
- `packages/theme-tang` — default theme (Mintlify-inspired)
- `packages/theme-pith` — editorial alternative
- `packages/theme-{pip,readable,geist}` — additional themes
- `examples/` — test corpora (Opennem, basic, etc.)
- `tests/parity/` — Mintlify parity tests
- `install.sh`, `install.ps1` — curl-installer scripts

## Develop

```sh
bun install
bun run --parallel format:check lint typecheck
```

Run the install smoke (reproduces `bunx`/`npx` resolution against a
clean install, outside the workspace):

```sh
bun run scripts/smoke-tarball.ts
```

## License

MIT
