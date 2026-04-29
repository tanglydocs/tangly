# Tangly Mintlify-compatible components

Drop-in `.astro` components matching the Mintlify component API, intended for use inside MDX content rendered by `@astrojs/mdx`. Styling: Tailwind v4 utility classes (no config). Icons: `lucide` (with FA-name aliasing).

Import via the barrel:

```ts
import * as Components from "@tangly/theme-tang/components";
```

## Components

### Priority subset (Opennem corpus)

| Component        | Props                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| `Card`           | `title?, icon?, href?, horizontal?, img?, color?` + children           |
| `CardGroup`      | `cols?: 1 \| 2 \| 3 \| 4` (default `2`) + children                     |
| `CodeGroup`      | none — wraps multiple `<pre>` children, renders tabbed switcher        |
| `Frame`          | `caption?` + children                                                  |
| `Note`           | none + children (blue)                                                 |
| `Tip`            | none + children (emerald)                                              |
| `Warning`        | none + children (amber)                                                |
| `Info`           | none + children (sky)                                                  |
| `Check`          | none + children (emerald, check icon)                                  |
| `Danger`         | none + children (red)                                                  |
| `Update`         | none + children (violet, sparkles)                                     |
| `Tabs`           | none — wraps `Tab` children                                            |
| `Tab`            | `title: string, icon?` + children                                      |
| `Steps`          | none — wraps `Step` children                                           |
| `Step`           | `title: string, icon?, titleSize?: 'p' \| 'h2' \| 'h3'` + children     |
| `Accordion`      | `title: string, defaultOpen?: boolean, icon?, description?` + children |
| `AccordionGroup` | none — wraps `Accordion` children                                      |

### Phase 1 remaining

| Component         | Props                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `Columns`         | `cols?: number` (default `2`) + children                                                                  |
| `Tooltip`         | `tip: string` + inline children                                                                           |
| `Icon`            | `icon: string, size?, color?` (FA-name aliases supported, falls back to `CircleHelp` with `console.warn`) |
| `Badge`           | `variant?: 'default' \| 'tip' \| 'warning' \| 'error'` + children                                         |
| `Expandable`      | `title: string, defaultOpen?: boolean` + children                                                         |
| `ParamField`      | `path? \| query? \| body? \| header?` (one of), `type?, required?, default?, deprecated?` + children      |
| `ResponseField`   | `name?` (or one of `path/query/body/header`), `type?, required?, default?, deprecated?` + children        |
| `RequestExample`  | none — labels children "Request example"                                                                  |
| `ResponseExample` | none — labels children "Response example"                                                                 |
| `Snippet`         | `file: string` (Phase-1 placeholder; resolves to children only — TODO Phase 2)                            |

## Notes

- Internal-only `_Callout.astro` is shared by all callout variants.
- All interactive components (Tabs, CodeGroup, Steps numbering) use small inline vanilla-JS `<script is:inline>` blocks — no React.
- Accordion / Expandable use native `<details>` for accessibility.
- Icon name resolution order: exact Lucide PascalCase → FA-alias map → PascalCase-of-input → `CircleHelp` fallback.
