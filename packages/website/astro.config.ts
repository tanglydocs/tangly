import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://tangly.dev",
  // Cloudflare Pages serves the canonical path without a trailing slash
  // (/license/ 301s to /license), so emit matching, non-redirecting sitemap
  // URLs and canonicals.
  trailingSlash: "never",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    service: { entrypoint: "astro/assets/services/noop" },
  },
});
