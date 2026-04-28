# Tangly — Future Work

Captured from `plans/SPEC.md` §6. Not committed for any specific phase. Promote to a real issue when scoped.

## Authoring & Rendering

- **Mermaid + KaTeX** built-in (one-line opt-in via remark/rehype plugins).
- **Extensible callouts** — register `<Tldr>` as a callout variant in `tangly.config.ts`.
- **Edit on GitHub** deep links derived from `docs.json` repo URL.

## Build / Performance

- **Build cache per page** — hash MDX + frontmatter + theme version, only recompile changes (matters at 500+ pages).
- **Image hotlink CDN** — for users on Cloudflare, route image requests through Cloudflare Images automatically.
- **Sub-path hosting** — `/docs` deploys (Mintlify supports this; we should too eventually).

## Configuration

- **Redirects-as-code** — `redirects.ts` returning a function, not just a static map.
- **Per-page AI context** — frontmatter `aiContext: "..."` concatenated with retrieved chunks during chat.

## Ecosystem

- **Plugin API** — third-party packages can register MDX components, remark plugins, and config schema extensions.
- **Web editor** — like Mintlify's, but only as a separate optional package. Not required.

## Adapters / Integrations

- **Analytics adapters** — Plausible, Fathom, PostHog (PostHog already in Nik's stack — start there).
- **Comments / feedback widget** — "Was this helpful?" → webhook.

## Quality

- **A11y audit on build** — fail build on critical axe violations.
