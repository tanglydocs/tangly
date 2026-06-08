// @ts-check
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";
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
import rehypeAnnotations from "./src/lib/rehype-annotations.mjs";
import rehypeBaseLinks from "./src/lib/rehype-base-links.mjs";
import rehypeGlossary from "./src/lib/rehype-glossary.mjs";
import remarkExplicitIds from "./src/lib/remark-explicit-ids.mjs";
import remarkH1Warn from "./src/lib/remark-h1-warn.mjs";
import remarkMermaid from "./src/lib/remark-mermaid.mjs";
import recmaSnippetComponents from "./src/lib/recma-snippet-components.mjs";
import remarkMintlifyCompat from "./src/lib/remark-mintlify-compat.mjs";
import remarkSnippetIslands from "./src/lib/remark-snippet-islands.mjs";
import {
  transformerTanglyAnnotations,
  transformerTanglyChrome,
} from "./src/lib/shiki-transformers.mjs";
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
    : (codeConfig.theme ?? { light: "vitesse-light", dark: "vitesse-dark" });
const codeCopyButton = codeConfig.copyButton !== false;

// Load glossary entries once at config-load. Errors are non-fatal —
// a missing or malformed glossary file disables the feature for this
// run rather than breaking the build.
let glossaryEntries = [];
try {
  const { loadGlossary } = await import("tangly");
  glossaryEntries = loadGlossary(userRoot);
} catch {
  /* glossary is optional */
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
  // Astro 6.2 made `server` a required (non-optional) preprocessed field
  // in its config schema. Specify an empty block so defaults apply on
  // 6.2+ while remaining a no-op on 6.1.x.
  server: {},
  ...(adapter ? { adapter } : {}),
  integrations: [
    tanglyIntegration({ userRoot, configFile, includeDrafts }),
    // Preact with `compat` aliases react/react-dom → preact/compat so
    // Mintlify-style `/snippets/*.jsx` React components (hooks, className)
    // render as Astro islands. Zero client JS ships unless a page actually
    // hydrates one (the remark-snippet-islands plugin auto-adds the
    // `client:visible` directive at snippet call sites).
    preact({ compat: true }),
    mdx({
      remarkPlugins: [
        remarkMintlifyCompat,
        remarkSnippetIslands,
        remarkH1Warn,
        remarkExplicitIds,
        remarkMermaid,
        remarkGfm,
        remarkMath,
      ],
      rehypePlugins: [
        [rehypeBaseLinks, { base: baseUrl }],
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
              // Order: focus -> diff -> highlight -> meta -> annotations -> chrome.
              transformerNotationFocus(),
              transformerNotationDiff(),
              transformerNotationHighlight(),
              transformerMetaHighlight(),
              transformerTanglyAnnotations(),
              transformerTanglyChrome({ copyButton: codeCopyButton }),
            ],
          },
        ],
        // Pair annotated code-figures with the next `<ol>`. Runs after
        // shiki so it sees the marker attribute set by the transformer.
        rehypeAnnotations,
        // Glossary auto-link runs AFTER shiki so code blocks aren't touched.
        ...(glossaryEntries.length > 0 ? [[rehypeGlossary, { entries: glossaryEntries }]] : []),
      ],
      // Thread the host page's MDX components into imported `.mdx` snippets so
      // a snippet using <Note>/<Card>/… inherits the global component set.
      recmaPlugins: [recmaSnippetComponents],
      gfm: true,
      optimize: false,
    }),
  ],
  vite: {
    plugins: [tailwind()],
    // OG card deps must not be bundled into the prerender chunk: satori loads
    // its own yoga wasm and @resvg/resvg-wasm ships a .wasm resolved at runtime.
    ssr: { external: ["satori", "@resvg/resvg-wasm"] },
    optimizeDeps: { exclude: ["satori", "@resvg/resvg-wasm"] },
    // Absolute path to this runtime dir, baked in at the user's build time.
    // The OG renderer reads bundled fonts from <here>/src/og/fonts, which
    // import.meta.url can't locate once the endpoint is bundled into a chunk.
    define: { __TANGLY_RUNTIME_DIR__: JSON.stringify(__dirname) },
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
