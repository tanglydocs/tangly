// @ts-check
import mdx from "@astrojs/mdx";
import rehypeShiki from "@shikijs/rehype";
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from "@shikijs/transformers";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeGlossary from "./src/lib/rehype-glossary.mjs";
import remarkExplicitIds from "./src/lib/remark-explicit-ids.mjs";
import remarkMermaid from "./src/lib/remark-mermaid.mjs";
import remarkMintlifyCompat from "./src/lib/remark-mintlify-compat.mjs";
import { transformerTanglyChrome } from "./src/lib/shiki-transformers.mjs";
import tailwind from "@tailwindcss/vite";
import { tanglyIntegration } from "tangly/plugin";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Walk up to the workspace root so we can serve hoisted deps (katex fonts, etc.)
const workspaceRoot = resolve(__dirname, "../../..");

const userRoot = process.env.TANGLY_USER_ROOT;
if (!userRoot) {
  throw new Error("TANGLY_USER_ROOT env var is required. The tangly CLI sets this automatically.");
}

const configFile = process.env.TANGLY_CONFIG_FILE ?? "docs.json";
const baseUrl = process.env.TANGLY_BASE ?? "/";

// Pull `code` settings (theme, copyButton) from docs.json so the user can
// override defaults without touching astro.config. Errors are non-fatal —
// the manifest pipeline surfaces config issues via `tangly check`.
let codeConfig = {};
try {
  const docsPath = resolve(userRoot, configFile);
  if (existsSync(docsPath)) {
    const parsed = JSON.parse(readFileSync(docsPath, "utf8"));
    codeConfig = parsed?.code ?? {};
  }
} catch {
  /* swallow */
}

const codeThemes =
  typeof codeConfig.theme === "string"
    ? { light: codeConfig.theme, dark: codeConfig.theme }
    : codeConfig.theme ?? { light: "github-light", dark: "github-dark" };
const codeCopyButton = codeConfig.copyButton !== false;

// Load glossary entries once at config-load. Errors are non-fatal.
let glossaryEntries = [];
try {
  const { loadGlossary } = await import("tangly");
  glossaryEntries = loadGlossary(userRoot);
} catch {
  /* swallow — glossary is optional */
}
const includeDrafts =
  process.env.TANGLY_INCLUDE_DRAFTS === "1" ||
  process.env.TANGLY_INCLUDE_DRAFTS === "true" ||
  process.env.TANGLY_MODE === "dev";

// Deploy adapter is selected by the CLI via auto-detect or --adapter.
//
// Tangly v1 outputs are fully static, so output stays "static" regardless
// of adapter — the adapter is wired for forward-compat with Phase 6+ SSR
// features (AI chat endpoint, edge middleware) but is otherwise a no-op
// for prerendered docs. Vercel's adapter is safe to wire in static mode
// (it adds Vercel build metadata for free). Cloudflare + Node adapters
// reshape output in ways that conflict with our prerender pipeline today
// (Cloudflare runs Workers checks, Node forces server-mode prerender);
// they're auto-detected to surface intent in the banner + load behind
// `--adapter` for future-readiness, but the actual Astro adapter is only
// applied for vercel right now. When Phase 6 lands, this branch unlocks
// for all four.
const adapterName = process.env.TANGLY_ADAPTER ?? "static";

let adapter;
const output = "static";
if (adapterName === "vercel") {
  const { default: vercel } = await import("@astrojs/vercel");
  adapter = vercel({ webAnalytics: { enabled: false } });
} else if (adapterName !== "static" && adapterName !== "cloudflare" && adapterName !== "node") {
  throw new Error(
    `[tangly] Unknown adapter "${adapterName}". Expected: vercel | cloudflare | node | static.`,
  );
}

export default defineConfig({
  base: baseUrl,
  output,
  ...(adapter ? { adapter } : {}),
  integrations: [
    tanglyIntegration({ userRoot, configFile, includeDrafts }),
    mdx({
      remarkPlugins: [
        remarkMintlifyCompat,
        remarkExplicitIds,
        remarkMermaid,
        remarkGfm,
        remarkMath,
      ],
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
            themes: codeThemes,
            defaultColor: false,
            transformers: [
              // Order: focus -> diff -> highlight -> meta -> chrome.
              transformerNotationFocus(),
              transformerNotationDiff(),
              transformerNotationHighlight(),
              transformerMetaHighlight(),
              transformerTanglyChrome({ copyButton: codeCopyButton }),
            ],
          },
        ],
        // Glossary auto-link runs AFTER shiki so code blocks aren't touched.
        ...(glossaryEntries.length > 0
          ? [[rehypeGlossary, { entries: glossaryEntries }]]
          : []),
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
