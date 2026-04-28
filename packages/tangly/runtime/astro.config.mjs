// @ts-check
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import rehypeShiki from "rehype-shiki";
import remarkGfm from "remark-gfm";
import tailwind from "@tailwindcss/vite";
import { tanglyIntegration } from "tangly/plugin";

const userRoot = process.env.TANGLY_USER_ROOT;
if (!userRoot) {
  throw new Error("TANGLY_USER_ROOT env var is required. The tangly CLI sets this automatically.");
}

const configFile = process.env.TANGLY_CONFIG_FILE ?? "docs.json";
const baseUrl = process.env.TANGLY_BASE ?? "/";

export default defineConfig({
  base: baseUrl,
  output: "static",
  integrations: [
    tanglyIntegration({ userRoot, configFile }),
    mdx({
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [
          rehypeShiki,
          {
            themes: { light: "github-light", dark: "github-dark" },
          },
        ],
      ],
      gfm: true,
    }),
  ],
  vite: {
    plugins: [tailwind()],
  },
  markdown: {
    syntaxHighlight: false,
  },
});
