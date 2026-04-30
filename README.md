# Tangly

> Self-hosted, OSS docs framework. Renders Mintlify projects unmodified.

## Install

```bash
# Linux / macOS
curl -fsSL https://tangly.dev/install.sh | bash

# Windows (PowerShell)
iwr -useb https://tangly.dev/install.ps1 | iex
```

Or use `bunx tangly init` / `npx tangly init` / `bun add tangly`. See
[`packages/tangly/README.md`](./packages/tangly/README.md#install) for all paths.

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
