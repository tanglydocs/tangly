# Tangly

> Self-hosted, OSS docs framework. Renders Mintlify projects unmodified.

**Status: early preview.** Phase 0 scaffolding only.

## Goal

Render any existing Mintlify project (`docs.json` + `*.mdx`) without source edits. Build to a static site that drops onto Vercel or Cloudflare. Stay simple enough that one person can hold the whole codebase in their head.

See [`plans/SPEC.md`](./plans/SPEC.md) for the full brief.

## Repo

- `packages/tangly` — the npm package
- `packages/schema` — `@tangly/schema` (Zod + JSON Schema for `docs.json`)
- `packages/theme-tang` — default theme
- `packages/theme-pith` — editorial alternative theme
- `examples/` — test corpora (Opennem, basic, etc.)
- `tests/parity/` — Mintlify parity tests

## Develop

```sh
bun install
bun run --parallel format:check lint typecheck
```

## License

MIT
