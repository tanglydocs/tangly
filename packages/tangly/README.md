# tangly

> Self-hosted, open-source documentation framework. Drop-in compatible with Mintlify projects.

Tangly renders existing `docs.json` + MDX corpora **unmodified** — point it at a Mintlify-shaped project and it just works. Built on Astro 6, no proprietary backend, no vendor lock-in.

## Quick start

```bash
# One-line installer (Linux/macOS): writes a `tangly` wrapper to ~/.local/bin
curl -fsSL https://tangly.dev/install.sh | bash

# Or invoke ad hoc — no install needed
bunx tangly init   # bun
npx tangly init    # node

# Or add to your project as a dep
bun add tangly
npm install tangly
```

```bash
# Common commands
tangly init                # scaffold a new project
tangly migrate             # migrate from Mintlify (mint.json → docs.json)
tangly dev                 # local dev server
tangly build               # static build → ./dist
```

## Install

### Curl installer (Linux / macOS)

```bash
curl -fsSL https://tangly.dev/install.sh | bash
```

Detects `bun` (preferred) or `npm`/`npx`, pins to the latest tangly,
writes a wrapper to `~/.local/bin/tangly` that delegates to
`bunx tangly@<version>` (or `npx`) on every invocation. First run per
version downloads ~80MB of deps; subsequent runs hit the cache.

Override defaults:

```bash
# Pin a specific version
curl -fsSL https://tangly.dev/install.sh | bash -s -- --version 0.0.5

# Force npm instead of bun
TANGLY_PM=npm curl -fsSL https://tangly.dev/install.sh | bash

# Different bin directory
TANGLY_BIN_DIR=/usr/local/bin curl -fsSL https://tangly.dev/install.sh | bash
```

### PowerShell installer (Windows)

```powershell
iwr -useb https://tangly.dev/install.ps1 | iex
```

Same model as the bash installer; wrapper goes to `$env:LOCALAPPDATA\tangly\bin\tangly.cmd`.

### bunx / npx (zero install)

```bash
bunx tangly init           # always uses latest
bunx tangly@0.0.5 init     # pinned
npx tangly init            # node equivalent
```

### Project dependency

```bash
bun add tangly             # or: npm install tangly
bunx tangly init           # or: npx tangly init
```

For the bleeding-edge build off `main`:

```bash
bun add tangly@dev
```

> **Why no standalone binary?** Tangly drives Astro at build time, and
> Astro's plugin ecosystem (vite, tailwind oxide native bindings, mdx,
> shiki) requires real on-disk `node_modules`. A single executable can't
> ship a working plugin tree, so the installer wraps `bunx`/`npx` instead.

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
