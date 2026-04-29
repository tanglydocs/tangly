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
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Walk up to the workspace root so we can serve hoisted deps (katex fonts, etc.)
const workspaceRoot = resolve(__dirname, "../../..");

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
            content: {
              type: "element",
              tagName: "svg",
              properties: {
                xmlns: "http://www.w3.org/2000/svg",
                width: 14,
                height: 14,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                ariaHidden: "true",
              },
              children: [
                {
                  type: "element",
                  tagName: "path",
                  properties: {
                    d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "path",
                  properties: {
                    d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
                  },
                  children: [],
                },
              ],
            },
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
    server: {
      fs: {
        // katex (and other workspace deps under bun's hoist dir) must be
        // explicitly allowed for Vite to serve their font assets in dev.
        allow: [process.cwd(), userRoot, workspaceRoot],
      },
    },
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
