# Examples

Local-only test corpora live here; most are gitignored.

## Setting up `opennem`

The Open Electricity (Opennem) docs are our primary parity-testing corpus.

```sh
# Symlink for local iteration:
ln -s ~/Projects/Opennem/opennem/docs ./opennem

# Or clone fresh:
git clone https://github.com/opennem/opennem.git /tmp/opennem
ln -s /tmp/opennem/docs ./opennem
```

The path `examples/opennem` is gitignored. Each developer wires their own.

`packages/schema/fixtures/opennem-docs.json` is a vendored snapshot of the corpus's `docs.json` for CI tests — that's the authoritative test artifact, not the symlink.
