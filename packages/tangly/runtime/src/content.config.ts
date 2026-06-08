import { pathToFileURL } from "node:url";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const userRoot = process.env.TANGLY_USER_ROOT;
if (!userRoot) {
  throw new Error("TANGLY_USER_ROOT env var is required");
}

const docs = defineCollection({
  loader: glob({
    // Pass an absolute `file:` URL, not the raw path. Astro resolves a string
    // base via `new URL(base, root)`; on Windows a drive-letter path like
    // `E:\project` parses `E:` as a URL scheme, yielding a non-`file:` URL and
    // a `ERR_INVALID_URL_SCHEME` crash. pathToFileURL is correct everywhere.
    base: pathToFileURL(userRoot),
    pattern: [
      "**/*.{md,mdx}",
      "!**/_*.{md,mdx}",
      // Project meta files Mintlify auto-ignores (keep in sync with
      // IGNORED_META_MD in src/manifest/scan-pages.ts, which matches
      // case-insensitively). picomatch is case-sensitive, so spell each letter
      // as a [Xx] class to catch any casing (README/readme/Readme/...).
      // AGENTS.md is intentionally not ignored — Mintlify renders it.
      "!**/[Rr][Ee][Aa][Dd][Mm][Ee].md",
      "!**/[Ll][Ii][Cc][Ee][Nn][Ss][Ee].md",
      "!**/[Cc][Hh][Aa][Nn][Gg][Ee][Ll][Oo][Gg].md",
      "!**/[Cc][Oo][Nn][Tt][Rr][Ii][Bb][Uu][Tt][Ii][Nn][Gg].md",
      "!**/node_modules/**",
      "!**/.astro/**",
      "!**/.tangly/**",
      "!**/.next/**",
      "!**/.git/**",
      "!**/dist/**",
      // Root-level reserved dirs — keep in sync with SKIP_DIRS_AT_ROOT in
      // src/manifest/scan-pages.ts (root-only, so nested reference/components/
      // etc. stay valid doc paths).
      "!snippets/**",
      "!components/**",
      "!templates/**",
      "!public/**",
      "!static/**",
      "!assets/**",
    ],
  }),
});

export const collections = { docs };
