import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const userRoot = process.env.TANGLY_USER_ROOT;
if (!userRoot) {
  throw new Error("TANGLY_USER_ROOT env var is required");
}

const docs = defineCollection({
  loader: glob({
    base: userRoot,
    pattern: [
      "**/*.{md,mdx}",
      "!**/_*.{md,mdx}",
      "!**/README.md",
      "!snippets/**",
      "!components/**",
      "!templates/**",
    ],
  }),
});

export const collections = { docs };
