# tangly

> Self-hosted, open-source documentation framework. Drop-in compatible with Mintlify projects.

Tangly renders existing `docs.json` + MDX corpora **unmodified** — point it at a Mintlify-shaped project and it just works. Built on Astro 6, no proprietary backend, no vendor lock-in.

## Quick start

```bash
# Scaffold a new docs project
npx tangly init

# Migrate from Mintlify (mint.json → docs.json, in place)
npx tangly migrate

# Develop locally
npx tangly dev

# Production build
npx tangly build
```

## Install

```bash
# Most users — invoke ad hoc, no install needed
npx tangly init

# Or add as a dev dependency
bun add -D tangly
npm install -D tangly
```

For the bleeding-edge build off `main`:

```bash
bun add -D tangly@dev
```

## What you get

- **Mintlify compatibility** — every `docs.json` field, all 14+ MDX components (Card, Tabs, Steps, Accordion, ParamField, etc.), OpenAPI rendering.
- **Theming** — drop-in themes via `@tanglydocs/theme-*` packages. Default `tang` (Mintlify-Mint inspired); alternatives `pith`, `pip`, `readable`, `geist`.
- **No SaaS** — your docs build to static HTML, deploy anywhere (Vercel, Cloudflare, GitHub Pages, S3, your own box).
- **CLI**: `init`, `dev`, `build`, `migrate`, `add`, `eject`, `preview`, `check`.

## Documentation

- Source: [github.com/tanglydocs/tangly](https://github.com/tanglydocs/tangly)
- Issues: [github.com/tanglydocs/tangly/issues](https://github.com/tanglydocs/tangly/issues)

## License

MIT
