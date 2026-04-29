# Tangly — agent conventions

Tangly is a self-hosted, OSS docs framework that renders Mintlify projects unmodified. Spec: `plans/SPEC.md`. Status: Phase 1 + Phase 2 done.

## Workflow

- One commit per numbered task in the plan, conventional-commit form: `type(scope): message`. Scopes: `cli`, `schema`, `manifest`, `theme-tang`, `theme-pith`, `runtime`, `plugin`, `build`, `phase1`, `phase2`, `repo`, `docs`.
- One PR per phase. Don't merge until acceptance criteria pass.
- Run `/review` skill at the end of every phase. Address every high-severity finding before declaring the phase done. Procedure documented at `~/.claude/skills/review`.
- Update `tests/parity/REPORT.md` while iterating against `mintlify dev`.

## Tooling (locked)

- `bun` for everything. `bun run` scripts; `bun add` for deps; `bun x` for one-shot. Don't use `npm`/`pnpm`/`yarn`.
- `oxfmt` (format), `oxlint` (lint), `tsgo` (typecheck via `@typescript/native-preview`), `vitest` (tests).
- oxfmt does NOT understand MDX/Astro/Markdown. `.prettierignore` (oxfmt honors it) excludes `docs/`, `examples/`, `**/*.mdx`, `**/*.md`, `**/*.astro`. Add to it whenever new content directories appear.
- Astro 6 + Vite 7. Vite is pinned via root `overrides` because Tailwind v4 pulls a newer Vite that conflicts with Astro's bundled version.
- Tailwind v4. Theme components import `@source` directives in `theme.css` because Tailwind's content scanner only auto-detects files in the consuming project — components in the `theme-*` packages must be explicitly listed.

## Layout

- `packages/tangly` — CLI + manifest + Vite plugin + runtime Astro app (`runtime/`). Public.
- `packages/schema` — `@tanglydocs/schema`: Zod schema for `docs.json`, frontmatter, mint→docs migrator. Private workspace pkg (the `@tangly` org name was unavailable on npm).
- `packages/theme-tang` — default theme (Mintlify-Mint inspired). Private workspace pkg.
- `packages/theme-pith` — editorial alternative theme (serif headings, cream bg). Private workspace pkg.
- `docs/` — Tangly's own docs, rendered by Tangly itself via `bun run dev:docs` (port 4322).
- `examples/opennem/` — symlink to `~/Projects/Opennem/opennem/docs/` for parity testing. Gitignored. Each dev wires their own.
- `packages/schema/fixtures/opennem-docs.json` — vendored snapshot used by CI tests when no symlink exists.

## Browser parity loop

- `bun run dev:opennem` (port 4321) — render Open Electricity corpus.
- `mint dev` from `~/Projects/Opennem/opennem/docs/` — render the same corpus through Mintlify.
- Compare side-by-side in Chrome. Drive both via `mcp__claude-in-chrome__*` tools when validating layout/components/OpenAPI.
- **Always screenshot before declaring UI work done.** DOM/CSS inspection alone has missed Tailwind content-scanner gaps and prose styling regressions.

## Build/dev assumptions

- Tangly runs Astro programmatically with `root` pointing at `packages/tangly/runtime/`. The user's project root is exposed via `TANGLY_USER_ROOT` env var; `TANGLY_MODE=dev` enables draft visibility; `TANGLY_INCLUDE_DRAFTS=1` overrides for staging builds.
- Static assets (`/images`, `/logo`, `/public`, `/static`, `/assets`) are served by middleware in dev and copied to `dist/` in build.
- Mintlify quirks: `<latex>...</latex>` blocks get rewritten to `$$...$$` before MDX parses; relative Markdown image refs (`![](../images/foo)`) get rewritten to absolute (`/images/foo`) so Astro's asset pipeline doesn't hit cache misses.
- Image optimization is disabled (`@astrojs/mdx` `optimize: false` + `image.service: noop`) — Mintlify projects use absolute URLs that bypass Astro's pipeline.

## Mintlify compatibility status

- All 14+ MDX components render (Card, CardGroup, Note, Tip, Warning, Info, Check, Danger, Update, Tabs, Tab, Steps, Step, Accordion, AccordionGroup, Frame, CodeGroup, ParamField, ResponseField, Snippet placeholder, OpenApiEndpoint).
- `docs.json` schema accepts every Mintlify top-level field. Theme aliases (mint/maple/palm/willow/linden/almond/aspen/luma/sequoia) map to `tang`. `pith` is the only second-tier theme today.
- `mint.json` legacy parses via `@tanglydocs/schema/convertMintToDocs`. CLI: `tangly migrate` (renamed from `upgrade` per user).

## Things the user has called out

- Renamed `upgrade` → `migrate`. Don't reintroduce `upgrade`.
- Skip `--tunnel` flag from SPEC §7 / Phase 2 — handled externally via taskmux.
- 404 + 500 pages must be customizable as templates. User can drop `404.mdx` / `500.mdx` at project root to override.
- Tangly is its own dogfood — keep `docs/` up to date as features land.

## Don't

- Don't use `pnpm`/`npm`/`yarn` (use `bun`).
- Don't run `oxfmt` on `*.mdx`, `*.md`, `*.astro` (it mangles them).
- Don't introduce frameworks beyond Astro + MDX + Tailwind (no React Router, Next.js, etc).
- Don't break the parity invariant: the Opennem corpus is the acceptance test. If something breaks parity, fix forward — don't divert.
