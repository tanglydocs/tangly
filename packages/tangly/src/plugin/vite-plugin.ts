import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { type FSWatcher, watch } from "chokidar";
import type { Plugin, ViteDevServer } from "vite";
import { buildManifest } from "../manifest/index.js";
import { scanPages } from "../manifest/scan-pages.js";
import type { Manifest } from "../manifest/types.js";

async function collectDraftSlugs(userRoot: string): Promise<string[]> {
  const all = await scanPages(userRoot);
  return all.filter((p) => Boolean(p.frontmatter?.draft)).map((p) => p.slug);
}

/**
 * Resolve the chain of public-asset roots for the active theme. First match
 * wins on lookup; first-seen wins on copy. Higher = more specific.
 *
 *   <userRoot>                     (Mintlify-style: /images at project root)
 *   <userRoot>/theme/public        (project's per-theme override)
 *   <activeTheme>/public           (theme-tang or theme-pith bundled assets)
 *   <theme-ui>/public              (shared baseline assets)
 */
export function buildPublicCascade(userRoot: string, themeName: string | undefined): string[] {
  const roots: string[] = [userRoot];

  const userThemePublic = resolve(userRoot, "theme", "public");
  if (existsSync(userThemePublic)) roots.push(userThemePublic);

  // Walk up from this file (`packages/tangly/dist/plugin/vite-plugin.js`) to
  // the workspace's `packages/` directory, then into each theme.
  const here = new URL(".", import.meta.url).pathname;
  const packagesDir = resolve(here, "..", "..", "..");
  const active = themeName === "pith" ? "pith" : "tang";

  const activeThemePublic = resolve(packagesDir, `theme-${active}`, "public");
  if (existsSync(activeThemePublic)) roots.push(activeThemePublic);

  const themeUiPublic = resolve(packagesDir, "theme-ui", "public");
  if (existsSync(themeUiPublic)) roots.push(themeUiPublic);

  return roots;
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
      // Pre-process Mintlify-specific MDX quirks before MDX parses JSX or
      // Astro's asset pipeline tries to resolve relative image paths.
      if (!id.endsWith(".mdx") && !id.endsWith(".md")) return null;

      let out = code;
      let changed = false;

      // <latex>...</latex> contains raw LaTeX whose curly braces would
      // otherwise be parsed as JSX expressions, breaking the build.
      if (/<latex>/i.test(out)) {
        out = out.replace(
          /<latex>([\s\S]*?)<\/latex>/gi,
          (_m, body) => `\n\n$$\n${(body as string).trim()}\n$$\n\n`,
        );
        changed = true;
      }

      // Rewrite Markdown image references that point outside the file's
      // directory or use relative parent traversal. Mintlify projects
      // commonly write `![alt](../images/foo.webp)` expecting the docs root
      // to act as the public base. Astro's asset pipeline tries to resolve
      // these as build-time assets and fails when the cache has stale
      // entries; rewriting them to root-absolute paths routes them through
      // our static-asset middleware (dev) and copy-assets step (build).
      //
      // Match: ![alt](../something/foo.webp)  → ![alt](/something/foo.webp)
      // Don't touch: absolute URLs (http*) or already-rooted paths (/foo).
      const mdImageRe = /!\[([^\]]*)\]\(\s*((?:\.\.\/)+)([^)\s]+)\)/g;
      if (mdImageRe.test(out)) {
        out = out.replace(mdImageRe, (_m, alt, _dots, rest) => {
          const path = String(rest);
          const abs = path.startsWith("/") ? path : `/${path}`;
          return `![${alt as string}](${abs})`;
        });
        changed = true;
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

      // Serve user's project static directories (images/, logo/, etc.) as
      // root-level paths. Mintlify projects reference `/images/foo.png`
      // expecting to find it at `<root>/images/foo.png`.
      //
      // Cascade: <userRoot>/<dir>/<file> →
      //          <userRoot>/theme/public/<dir>/<file> →
      //          <activeTheme>/public/<dir>/<file> →
      //          <theme-ui>/public/<dir>/<file>
      // First match wins. Themes can ship default fonts/icons; users override.
      //
      // SECURITY: decode and confine to the prefix dir. A request like
      // `/images/../../../etc/passwd` must not escape its prefix root.
      devServer.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const m = url.match(/^\/(images|logo|public|static|assets)\/(.*)$/);
        if (!m) return next();
        let suffix: string;
        try {
          suffix = decodeURIComponent(m[2]!.split("?")[0]!.split("#")[0]!);
        } catch {
          return next();
        }
        if (isAbsolute(suffix)) return next();

        const prefix = m[1]!;
        const candidateRoots = buildPublicCascade(userRoot, manifest?.config.theme);
        let filePath: string | undefined;
        for (const root of candidateRoots) {
          const prefixDir = resolve(root, prefix);
          const candidate = resolve(prefixDir, suffix);
          const rel = relative(prefixDir, candidate);
          if (rel.startsWith("..") || isAbsolute(rel)) continue;
          if (existsSync(candidate)) {
            filePath = candidate;
            break;
          }
        }
        if (!filePath) return next();

        const ext = filePath.split(".").pop()?.toLowerCase();
        const types: Record<string, string> = {
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
          woff: "font/woff",
          woff2: "font/woff2",
          ttf: "font/ttf",
          otf: "font/otf",
        };
        if (ext && types[ext]) res.setHeader("Content-Type", types[ext]);
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
