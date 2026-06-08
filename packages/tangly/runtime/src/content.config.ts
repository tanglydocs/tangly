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
      // IGNORED_META_MD in src/manifest/scan-pages.ts). AGENTS.md is
      // intentionally not ignored — Mintlify renders it.
      "!**/{README,readme,LICENSE,license,CHANGELOG,changelog,CONTRIBUTING,contributing}.md",
      "!**/node_modules/**",
      "!**/.astro/**",
      "!**/.tangly/**",
      "!**/.next/**",
      "!**/.git/**",
      "!**/dist/**",
      "!snippets/**",
      "!components/**",
      "!templates/**",
    ],
  }),
});

export const collections = { docs };
