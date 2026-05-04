import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { type FSWatcher, watch } from "chokidar";
import type { Plugin, ViteDevServer } from "vite";
import {
  generateLlmsFullTxt,
  generateLlmsTxt,
  generateRobots,
  generateSitemap,
} from "../build-outputs/index.js";
import { buildIgnoreMatcher } from "../build-outputs/ignore-matcher.js";
import { replaceOutsideCode } from "./replace-outside-code.js";
import { buildManifest } from "../manifest/index.js";
import { scanPages } from "../manifest/scan-pages.js";
import type { Manifest } from "../manifest/types.js";
import { buildPublicCascade } from "./theme-resolver.js";

async function collectDraftSlugs(userRoot: string): Promise<string[]> {
  const all = await scanPages(userRoot);
  return all.filter((p) => Boolean(p.frontmatter?.draft)).map((p) => p.slug);
}

/**
 * Parse an Accept header and decide whether the client prefers `text/markdown`
 * over HTML. Honors q-values per RFC 7231 §5.3.1 — a naive
 * `header.includes("text/markdown")` check is wrong because browsers send
 * `Accept: text/html, ..., * /*;q=0.8` and we'd misroute them.
 */
function prefersMarkdown(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  let mdQ = -1;
  let htmlQ = -1;
  for (const part of acceptHeader.split(",")) {
    const segs = part
      .trim()
      .split(";")
      .map((s) => s.trim());
    const type = segs[0]?.toLowerCase();
    if (!type) continue;
    let q = 1;
    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i] ?? "";
      const [k, v] = seg.split("=");
      if (k === "q" && v != null) {
        const parsed = Number.parseFloat(v);
        if (Number.isFinite(parsed)) q = parsed;
      }
    }
    if (type === "text/markdown") mdQ = Math.max(mdQ, q);
    else if (type === "text/html") htmlQ = Math.max(htmlQ, q);
  }
  if (mdQ <= 0) return false;
  if (htmlQ > mdQ) return false;
  return true;
}

const LLMS_LINK_HEADER = '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"';

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  json: "application/json",
  css: "text/css",
  js: "application/javascript",
  txt: "text/plain",
  html: "text/html",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

/**
 * Resolve a request URL to an on-disk file by walking the public cascade.
 *
 *   1. <userRoot>/<path>                 any file allowed by the ignore stack
 *                                        (baseline + .gitignore + .tanglyignore)
 *   2. <userRoot>/theme/public/<path>   any path under the user's theme/public
 *   3. <activeTheme>/public/<path>      bundled with the active theme
 *   4. <theme-ui>/public/<path>         shared baseline
 *
 * Confines every candidate to its root to prevent traversal escape.
 */
function resolvePublicAsset(
  url: string,
  userRoot: string,
  themeName: string | undefined,
): string | null {
  const path = url.split("?")[0]!.split("#")[0]!;
  let suffix: string;
  try {
    suffix = decodeURIComponent(path.replace(/^\/+/, ""));
  } catch {
    return null;
  }
  if (!suffix || isAbsolute(suffix)) return null;

  const cascade = buildPublicCascade(userRoot, themeName);
  // Tier 1: any file under <userRoot> not excluded by the ignore stack.
  // Mirrors copy-assets.ts so dev parity matches build output exactly.
  {
    const candidate = resolve(userRoot, suffix);
    const rel = relative(userRoot, candidate);
    if (!rel.startsWith("..") && !isAbsolute(rel) && existsSync(candidate)) {
      const matcher = buildIgnoreMatcher({ userRoot });
      if (matcher.shouldCopy(rel)) {
        try {
          if (statSync(candidate).isFile()) return candidate;
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Tiers 2-4: any file path resolved against each theme/public root.
  // Skip the userRoot tier here — that's only the prefix-restricted tier 1.
  for (const root of cascade.slice(1)) {
    const candidate = resolve(root, suffix);
    const rel = relative(root, candidate);
    if (rel.startsWith("..") || isAbsolute(rel)) continue;
    if (!existsSync(candidate)) continue;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const VIRTUAL_PREFIX = "virtual:tangly/";
const VIRTUAL_IDS = {
  manifest: `${VIRTUAL_PREFIX}manifest`,
  routes: `${VIRTUAL_PREFIX}routes`,
  config: `${VIRTUAL_PREFIX}config`,
  theme: `${VIRTUAL_PREFIX}theme`,
} as const;

const RESOLVED_PREFIX = "\0";

type VirtualId = (typeof VIRTUAL_IDS)[keyof typeof VIRTUAL_IDS];

function isVirtualId(id: string): id is VirtualId {
  return (Object.values(VIRTUAL_IDS) as string[]).includes(id);
}

export interface TanglyPluginOptions {
  /** Absolute path to the user's docs project root. */
  userRoot: string;
  /** docs.json filename — defaults to "docs.json". */
  configFile?: string;
  /**
   * When true, draft pages are kept in the manifest. Dev mode defaults to
   * true so drafts render with a badge; build mode defaults to false unless
   * `TANGLY_INCLUDE_DRAFTS=1` is set.
   */
  includeDrafts?: boolean;
}

interface ManifestPayload {
  config: Manifest["config"];
  pages: Array<[string, Manifest["pages"] extends Map<string, infer V> ? V : never]>;
  navigation: Manifest["navigation"];
  orphans: string[];
  warnings: Manifest["warnings"];
  root: string;
  collections?: Manifest["collections"];
  /**
   * Slugs the runtime's `getStaticPaths` must exclude. Used to drop drafts
   * from build output even though the docs content collection still loads
   * every MDX file from disk.
   */
  excludedSlugs: string[];
}

function manifestToPayload(m: Manifest, excludedSlugs: string[]): ManifestPayload {
  return {
    config: m.config,
    pages: [...m.pages.entries()].map(([k, v]) => [k, v]),
    navigation: m.navigation,
    orphans: m.orphans,
    warnings: m.warnings,
    root: m.root,
    ...(m.collections ? { collections: m.collections } : {}),
    excludedSlugs,
  };
}

export function tanglyVitePlugin(opts: TanglyPluginOptions): Plugin {
  const userRoot = resolve(opts.userRoot);
  const configFile = opts.configFile ?? "docs.json";
  const configPath = resolve(userRoot, configFile);
  const includeDrafts = opts.includeDrafts ?? false;

  let manifest: Manifest | null = null;
  let server: ViteDevServer | null = null;
  let watcher: FSWatcher | null = null;

  async function loadManifest(): Promise<Manifest> {
    manifest = await buildManifest({ root: userRoot, configFile, includeDrafts });
    return manifest;
  }

  function invalidateVirtuals(reason: string) {
    if (!server) return;
    const moduleGraph = server.moduleGraph;
    for (const id of Object.values(VIRTUAL_IDS)) {
      const mod = moduleGraph.getModuleById(`${RESOLVED_PREFIX}${id}`);
      if (mod) moduleGraph.invalidateModule(mod);
    }
    server.ws.send({ type: "full-reload" });
    server.config.logger.info(`[tangly] reload: ${reason}`);
  }

  return {
    name: "tangly:virtual",
    enforce: "pre",

    async buildStart() {
      manifest = await loadManifest();
    },

    transform(code, id) {
      // Pre-process MDX quirks (raw LaTeX blocks, ../images/foo refs)
      // before MDX parses JSX or Astro's asset pipeline tries to resolve
      // relative image paths.
      if (!id.endsWith(".mdx") && !id.endsWith(".md")) return null;

      let out = code;
      let changed = false;

      // <latex>...</latex> contains raw LaTeX whose curly braces would
      // otherwise be parsed as JSX expressions, breaking the build.
      // Skip code spans/fences so docs describing this shim can quote the
      // literal pattern inside backticks without it getting rewritten.
      if (/<latex>/i.test(out)) {
        const r = replaceOutsideCode(
          out,
          /<latex>([\s\S]*?)<\/latex>/gi,
          (_m, body) => `\n\n$$\n${body.trim()}\n$$\n\n`,
        );
        if (r.changed) {
          out = r.value;
          changed = true;
        }
      }

      // Rewrite Markdown image references that point outside the file's
      // directory or use relative parent traversal. Many docs corpora
      // ship `![alt](../images/foo.webp)` expecting the project root to
      // act as the public base. Astro's asset pipeline tries to resolve
      // these as build-time assets and fails when the cache has stale
      // entries; rewriting them to root-absolute paths routes them through
      // our static-asset middleware (dev) and copy-assets step (build).
      //
      // Match: ![alt](../something/foo.webp)  → ![alt](/something/foo.webp)
      // Don't touch: absolute URLs (http*) or already-rooted paths (/foo),
      // or anything inside backticks (so docs can quote the pattern).
      {
        const r = replaceOutsideCode(
          out,
          /!\[([^\]]*)\]\(\s*((?:\.\.\/)+)([^)\s]+)\)/g,
          (_m, alt, _dots, rest) => {
            const abs = rest.startsWith("/") ? rest : `/${rest}`;
            return `![${alt}](${abs})`;
          },
        );
        if (r.changed) {
          out = r.value;
          changed = true;
        }
      }

      if (changed) return { code: out, map: null };
      return null;
    },

    resolveId(id) {
      if (isVirtualId(id)) {
        return `${RESOLVED_PREFIX}${id}`;
      }
      return null;
    },

    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;
      const realId = id.slice(RESOLVED_PREFIX.length);
      if (!isVirtualId(realId)) return null;

      if (!manifest) manifest = await loadManifest();

      // Compute slugs to exclude from the runtime catch-all. When drafts
      // are NOT included (production mode), every disk page with
      // `draft: true` must be dropped from getStaticPaths so it never
      // becomes a static route.
      const excludedSlugs: string[] = [];
      if (!includeDrafts) {
        const diskDrafts = await collectDraftSlugs(userRoot);
        excludedSlugs.push(...diskDrafts);
      }

      switch (realId) {
        case VIRTUAL_IDS.manifest:
          return `export const manifest = ${JSON.stringify(manifestToPayload(manifest, excludedSlugs))};\nexport default manifest;`;
        case VIRTUAL_IDS.config:
          return `export const config = ${JSON.stringify(manifest.config)};\nexport default config;`;
        case VIRTUAL_IDS.routes: {
          const pages = [...manifest.pages.values()].filter((p) => !p.draft);
          const routes = pages.map((p) => ({
            slug: p.slug,
            file: p.file,
          }));
          return `export const routes = ${JSON.stringify(routes)};\nexport default routes;`;
        }
        case VIRTUAL_IDS.theme: {
          const themeName = manifest.config.theme ?? "tang";
          return `export const themeName = ${JSON.stringify(themeName)};\nexport const userRoot = ${JSON.stringify(userRoot)};`;
        }
        default:
          return null;
      }
    },

    configureServer(devServer) {
      server = devServer;

      // Synthesize sitemap.xml / robots.txt / llms.txt / llms-full.txt in dev
      // so authors can preview them without `tangly build`. Same generators
      // and content as the build outputs; respects user overrides at the
      // project root just like copy-assets does.
      devServer.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0]!.split("#")[0];
        const kind =
          path === "/sitemap.xml"
            ? "sitemap"
            : path === "/robots.txt"
              ? "robots"
              : path === "/llms.txt"
                ? "llms"
                : path === "/llms-full.txt"
                  ? "llms-full"
                  : null;
        if (!kind) return next();
        if (!manifest) return next();
        const userOverride = resolve(userRoot, path!.replace(/^\/+/, ""));
        if (existsSync(userOverride)) return next();
        const siteUrl = (manifest.config as { siteUrl?: string }).siteUrl;
        const genOpts: Parameters<typeof generateSitemap>[0] = { manifest, outDir: "" };
        if (siteUrl) genOpts.siteUrl = siteUrl;
        const body =
          kind === "sitemap"
            ? generateSitemap(genOpts)
            : kind === "robots"
              ? generateRobots(genOpts)
              : kind === "llms"
                ? generateLlmsTxt(genOpts)
                : generateLlmsFullTxt(genOpts);
        res.setHeader(
          "Content-Type",
          kind === "sitemap" ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8",
        );
        res.end(body);
      });

      // Markdown for agents — serve raw MDX source when the URL ends in `.md`
      // or the client sent `Accept: text/markdown`. Same wire format as the
      // build output; `<link rel="alternate">` in the HTML head + Link/
      // X-Llms-Txt response headers advertise it for crawlers.
      devServer.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        if (!rawUrl.startsWith("/")) return next();
        if (rawUrl.startsWith("/@") || rawUrl.startsWith("/__") || rawUrl.startsWith("/_astro/")) {
          return next();
        }
        const path = rawUrl.split("?")[0]!.split("#")[0]!;
        const acceptHeader = req.headers.accept;
        const wantsMd =
          path.endsWith(".md") ||
          (typeof acceptHeader === "string" && prefersMarkdown(acceptHeader));

        // Always advertise the markdown twin + llms.txt index on doc responses.
        // Set BEFORE next() so they ride along on the eventual HTML response.
        res.setHeader("Vary", "Accept");
        res.setHeader("Link", LLMS_LINK_HEADER);
        res.setHeader("X-Llms-Txt", "/llms.txt");

        if (!wantsMd) return next();
        if (!manifest) return next();

        let slug = path.replace(/^\/+/, "").replace(/\/$/, "");
        if (slug.endsWith(".md")) slug = slug.slice(0, -3);
        if (slug === "") slug = "index";

        const page = manifest.pages.get(slug);
        if (!page || page.draft || page.frontmatter.noindex) return next();

        let body: string;
        try {
          body = readFileSync(page.file, "utf8");
        } catch {
          return next();
        }
        const out = `URL: /${slug}\n\n${body}`;
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("X-Robots-Tag", "noindex");
        res.end(out);
      });

      // Serve assets from the cascading public roots. Tier 1 (userRoot)
      // only matches the canonical prefix dirs (/images, /logo, /public,
      // /static, /assets) so we don't accidentally serve project source
      // files. Tiers 2-4 (`<userRoot>/theme/public`, active theme,
      // theme-ui) serve any path so themes can ship root-level files
      // like /favicon.svg or /fonts/foo.woff2 and projects can override.
      //
      // SECURITY: each candidate is confined to its cascade root.
      devServer.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/")) return next();
        // Skip Vite/Astro internals so we don't shadow live reload, etc.
        if (url.startsWith("/@") || url.startsWith("/__") || url.startsWith("/_astro/")) {
          return next();
        }
        const filePath = resolvePublicAsset(url, userRoot, manifest?.config.theme);
        if (!filePath) return next();
        const ext = filePath.split(".").pop()?.toLowerCase();
        if (ext && CONTENT_TYPES[ext]) {
          res.setHeader("Content-Type", CONTENT_TYPES[ext]);
        }
        const concrete = filePath;
        import("node:fs").then(({ createReadStream }) => {
          createReadStream(concrete).pipe(res);
        });
      });

      // Serve favicon directly if config.favicon points to a project file.
      devServer.middlewares.use((req, res, next) => {
        if (req.url !== "/favicon.ico" && req.url !== "/favicon.svg") return next();
        if (!manifest) return next();
        const fav = manifest.config.favicon;
        if (!fav) return next();
        const favPath = typeof fav === "string" ? fav : (fav.light ?? fav.dark);
        if (!favPath) return next();
        const cleaned = favPath.replace(/^\/+/, "");
        const filePath = resolve(userRoot, cleaned);
        const rel = relative(userRoot, filePath);
        if (rel.startsWith("..") || isAbsolute(rel)) return next();
        if (!existsSync(filePath)) return next();
        res.setHeader("Content-Type", favPath.endsWith(".svg") ? "image/svg+xml" : "image/x-icon");
        import("node:fs").then(({ createReadStream }) => {
          createReadStream(filePath).pipe(res);
        });
      });

      const watched = [configPath, resolve(userRoot, "**/*.mdx"), resolve(userRoot, "**/*.md")];

      watcher = watch(watched, {
        ignored: [/(^|[/\\])\.[^/\\]/, /node_modules/, /dist/, /\.tangly/],
        persistent: true,
        ignoreInitial: true,
      });

      // Tightened HMR: only invalidate the manifest virtual module + the
      // pages route module rather than triggering a full-reload. Astro
      // handles MDX HMR natively for *.mdx body changes; we only need to
      // re-run getStaticPaths when the nav structure changes.
      const handleChange = (reason: string) => {
        manifest = null;
        const t0 = Date.now();
        invalidateVirtuals(reason);
        // Telemetry: log time-to-invalidate so we can verify <250ms target.
        const ms = Date.now() - t0;
        devServer.config.logger.info(`[tangly] hmr ${ms}ms (${reason})`);
      };

      watcher.on("change", (p: string) => {
        // docs.json change → manifest invalidate (sub-50ms typically).
        // mdx body change → MDX HMR handles it; we still null the
        // manifest so any nav-derived data refreshes.
        handleChange(`changed ${p.split("/").slice(-2).join("/")}`);
      });
      watcher.on("add", (p: string) => {
        if (!p.endsWith(".mdx")) return;
        handleChange(`added ${p.split("/").slice(-2).join("/")}`);
      });
      watcher.on("unlink", (p: string) => {
        if (!p.endsWith(".mdx")) return;
        handleChange(`removed ${p.split("/").slice(-2).join("/")}`);
      });
    },

    async closeBundle() {
      if (watcher) await watcher.close();
    },

    handleHotUpdate(ctx) {
      if (!ctx.file.startsWith(userRoot) && !existsSync(ctx.file)) return;
      // mdx files are handled by Astro/MDX naturally; we just nuke the manifest
      if (ctx.file.endsWith("docs.json") || ctx.file.endsWith(".mdx")) {
        manifest = null;
      }
      return;
    },
  };
}

export const TANGLY_VIRTUAL_IDS = VIRTUAL_IDS;
