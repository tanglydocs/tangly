# Examples

Local-only test corpora and theme demo sites live here. Everything in this folder is
gitignored; each developer wires up their own.

The theme demo projects (`demo-tang`, `demo-pith`, `demo-pip`, `demo-readable`,
`demo-geist`, `demo-starter`) are rendered by the dev servers (see the taskmux tasks) for
visual iteration on each theme.

For schema parity, vendored real-world `docs.json` snapshots live in
`packages/schema/fixtures/` and are parsed directly by CI. Those fixtures, not any local
corpus, are the authoritative test artifacts.
