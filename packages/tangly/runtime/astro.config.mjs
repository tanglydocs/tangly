// @ts-check
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeShiki from "rehype-shiki";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMintlifyCompat from "./src/lib/remark-mintlify-compat.mjs";
import tailwind from "@tailwindcss/vite";
import { tanglyIntegration } from "tangly/plugin";

const userRoot = process.env.TANGLY_USER_ROOT;
if (!userRoot) {
  throw new Error("TANGLY_USER_ROOT env var is required. The tangly CLI sets this automatically.");
}

const configFile = process.env.TANGLY_CONFIG_FILE ?? "docs.json";
const baseUrl = process.env.TANGLY_BASE ?? "/";
const includeDrafts =
  process.env.TANGLY_INCLUDE_DRAFTS === "1" ||
  process.env.TANGLY_INCLUDE_DRAFTS === "true" ||
  process.env.TANGLY_MODE === "dev";

export default defineConfig({
  base: baseUrl,
  output: "static",
  integrations: [
    tanglyIntegration({ userRoot, configFile, includeDrafts }),
    mdx({
      remarkPlugins: [remarkMintlifyCompat, remarkGfm, remarkMath],
      rehypePlugins: [
        rehypeKatex,
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "append",
            properties: {
              className: ["tangly-heading-anchor"],
              "aria-label": "Navigate to header",
            },
            content: { type: "text", value: "#" },
          },
        ],
        [
          rehypeShiki,
          {
            themes: { light: "github-light", dark: "github-dark" },
          },
        ],
      ],
      gfm: true,
      optimize: false,
    }),
  ],
  vite: {
    plugins: [tailwind()],
  },
  markdown: {
    syntaxHighlight: false,
  },
  // Mintlify-style projects reference images via absolute /images/... paths
  // resolved by our static-asset middleware. Astro's automatic image
  // optimization shouldn't try to process these at build time.
  image: {
    service: { entrypoint: "astro/assets/services/noop" },
  },
  experimental: {
    contentIntellisense: false,
  },
});
