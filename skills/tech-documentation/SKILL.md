---
name: tech-documentation
description: |
  Write effective technical documentation — READMEs, API references, developer
  guides, tutorials, runbooks, release notes, and how-to articles. Applies the
  Diátaxis framework to pick the right document type (tutorial / how-to /
  reference / explanation), structures pages top-down, enforces plain active
  voice, and grounds every claim in a runnable example. Distilled from
  Diátaxis, the Google developer documentation style guide, the Microsoft
  Writing Style Guide, Write the Docs, and GOV.UK content design.

  Apply when: writing or editing technical documentation, README files, API
  docs, developer guides, tutorials, runbooks, or release notes; reviewing a
  documentation PR; auditing existing documentation for clarity or structure;
  planning a documentation site's information architecture; deciding what
  document type a page should be; or any task that involves documentation
  writing, editing, or quality. Trigger keywords: documentation, docs, README,
  technical writing, API reference, developer guide, tutorial, runbook,
  release notes, diataxis, style guide, doc review.
license: MIT
compatibility: Designed for Claude Code and other agent-skills clients.
allowed-tools: Read, Write, Edit, Glob, Grep
metadata:
  author: tanglydocs
  version: 0.0.5
  category: documentation
  tags: documentation, docs, technical-writing, readme, api-docs, diataxis, style-guide, content, writing, doc-review
  homepage: https://tangly.dev
  repository: https://github.com/tanglydocs/tangly
---

# tech-documentation

Principles for writing technical docs that readers can actually use. Grounded in Diátaxis (diataxis.fr), the Google developer documentation style guide, the Microsoft Writing Style Guide, and the Write the Docs community.

## When to use

- Authoring or editing docs, READMEs, API references, guides, runbooks, release notes.
- Reviewing someone else's docs (PR review, content audit).
- Triaging "the docs are confusing" feedback.

## 1. Pick the doc type first (Diátaxis)

The single biggest mistake is mixing types in one page. Every doc has exactly one job:

| Type | Reader's goal | What it is | What it isn't |
| --- | --- | --- | --- |
| **Tutorial** | Learn by doing | A guided lesson; reader is a student | Not comprehensive. Skip edge cases. |
| **How-to guide** | Achieve a specific task | Recipe for a real-world goal | Not exhaustive. Assume the reader knows the basics. |
| **Reference** | Look up exact facts | Dry, complete, authoritative API/CLI/config listing | Not pedagogical. No tutorials inside. |
| **Explanation** | Understand why | Background, design rationale, trade-offs | Not actionable. No commands. |

If a page tries to do two of these, split it. Cross-link instead of merging.

## 2. Know the reader

Before writing, name:
- **Who** they are (role + experience level).
- **What** they already know (assumed prerequisites — list them up front).
- **What** they need to do or decide.
- **What** success looks like (what they'll have at the end).

Default audience: the second-most-experienced reader you expect — not the expert, not the absolute beginner.

## 3. Structure top-down

- Lead with **what + why** in the first two sentences. Readers bail fast.
- One H1 per page. Match the page title.
- H2/H3 are scan anchors. Make them descriptive (`## Configure the API key`, not `## Configuration`).
- Most important info first (inverted pyramid). Caveats and edge cases at the bottom.
- Short paragraphs (≤ 4 sentences). Bullets for parallel items. Tables for structured comparisons.
- Front-load each paragraph with the topic sentence.

## 4. Voice and tone

- **Active voice.** "Run the command" not "The command should be run."
- **Second person ("you").** Not "the user" or "we."
- **Present tense.** "The function returns…" not "The function will return…"
- **Plain language.** Define jargon on first use. If a simpler word works, use it.
- **No marketing fluff.** Cut "powerful," "seamlessly," "robust," "easily," "simply." If something is easy, the reader will discover that themselves.
- **Imperative for instructions.** "Set `port` to 4321." Not "You should set…"
- **Inclusive language.** Per the Microsoft style guide — avoid gendered pronouns, ableist phrasing, and culturally specific idioms.

## 5. Ground every claim in a runnable example

- Every concept gets a code block or a concrete example.
- Show **input AND output**. The reader needs to know what success looks like.
- Use **realistic data**, not `foo`/`bar`. `customer-id` beats `xyz`.
- Use **placeholders** the reader will visibly recognize: `<your-api-key>`, `${PROJECT_ID}`.
- Test every code block on every release. Stale examples destroy trust faster than missing docs.

## 6. Code blocks

- Always specify the language (` ```bash `, ` ```ts `, not bare ` ``` `).
- Keep them minimal — only what's needed for the point being made. No unrelated boilerplate.
- Make them copy-pasteable end-to-end. No `# comments explaining what to delete`.
- Don't truncate mid-example. Either show the full thing or split it cleanly.
- Show output in a separate block, labeled.

## 7. Links

- Link to detail rather than repeating it. One canonical source per concept.
- Don't say "click here." Name the destination: `see the [auth flow guide](…)`.
- Open external links in the same tab unless there's a strong reason not to.
- Link the first occurrence of a term in a section, not every occurrence.

## 8. Errors and edge cases

- Document what can go wrong, with the fix beside it.
- Quote error messages **verbatim** when useful — readers grep for them.
- Show the trigger, the message, and the resolution as a unit.

```
Error: ECONNREFUSED 127.0.0.1:5432
```

Fix: Postgres isn't running. Start it with `brew services start postgresql`.

## 9. Maintain

- **Date-stamp** time-sensitive content (changelogs, deprecations, "as of" notes).
- **Test code samples on every release.** Automate this if possible.
- **Remove stale content** rather than leaving it. Outdated docs are worse than no docs.
- **One source of truth.** Docs-as-code; reviewed in PRs alongside the change that triggers them.
- **Track docs debt** like code debt. A "TODO: rewrite once feature X lands" is a real ticket.

## 10. AI and LLM-friendly docs

Modern docs are read by both humans and LLMs. To serve both:
- Generate `llms.txt` / `llms-full.txt` (concise, structured page index for AI consumers — Tangly emits these by default).
- Use semantic HTML / clean Markdown — heading hierarchy carries meaning.
- Add `aiContext:` frontmatter or short summaries where the page topic isn't obvious from the slug.
- Avoid relying on visual layout alone (pure CSS columns, image-only diagrams). Provide a text equivalent.

## Editing checklist (pre-publish)

Run through this every time:

- [ ] Doc type is clear (tutorial / how-to / reference / explanation) — only one.
- [ ] First two sentences answer **what** and **why**.
- [ ] Audience and prerequisites stated up front.
- [ ] Headings are descriptive and scan-friendly.
- [ ] Active voice, second person, present tense throughout.
- [ ] No marketing fluff (`easily`, `simply`, `powerful`, `seamlessly`).
- [ ] Every concept has a runnable example with input + output.
- [ ] Every code block has a language tag.
- [ ] Every link names its destination.
- [ ] Errors are documented with verbatim messages and fixes.
- [ ] Time-sensitive content is dated.
- [ ] Code samples were tested at the current version.
- [ ] No duplicated content — link to the canonical source.

## Anti-patterns (delete on sight)

- "This is a powerful, easy-to-use, fully featured…" — marketing, not docs.
- "Simply run…" — if it's simple, the reader will see that.
- "More info coming soon" — delete the placeholder until it ships.
- "See the source code for details" — write the docs.
- "Click here" — name the destination.
- A wall of API methods with no usage example — pair reference with at least one how-to.
- Tutorials that quietly become reference dumps halfway through.

## References

- **Diátaxis** — diataxis.fr (the four-quadrant framework).
- **Google developer documentation style guide** — developers.google.com/style.
- **Microsoft Writing Style Guide** — learn.microsoft.com/style-guide.
- **Write the Docs** — writethedocs.org (community + principles).
- **GOV.UK content design** — gov.uk/guidance/content-design (plain English at scale).
- **The Documentation System** (Daniele Procida) — origin essay for Diátaxis.
