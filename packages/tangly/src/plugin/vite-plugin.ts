import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type FSWatcher, watch } from "chokidar";
import type { Plugin, ViteDevServer } from "vite";
import { buildManifest } from "../manifest/index.js";
import type { Manifest } from "../manifest/types.js";

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
}

interface ManifestPayload {
  config: Manifest["config"];
  pages: Array<[string, Manifest["pages"] extends Map<string, infer V> ? V : never]>;
  navigation: Manifest["navigation"];
  orphans: string[];
  warnings: Manifest["warnings"];
  root: string;
}

function manifestToPayload(m: Manifest): ManifestPayload {
  return {
    config: m.config,
    pages: [...m.pages.entries()].map(([k, v]) => [k, v]),
    navigation: m.navigation,
    orphans: m.orphans,
    warnings: m.warnings,
    root: m.root,
  };
}

export function tanglyVitePlugin(opts: TanglyPluginOptions): Plugin {
  const userRoot = resolve(opts.userRoot);
  const configFile = opts.configFile ?? "docs.json";
  const configPath = resolve(userRoot, configFile);

  let manifest: Manifest | null = null;
  let server: ViteDevServer | null = null;
  let watcher: FSWatcher | null = null;

  async function loadManifest(): Promise<Manifest> {
    manifest = await buildManifest({ root: userRoot, configFile });
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
      // Pre-process Mintlify-specific MDX quirks before MDX parses JSX.
      // <latex>...</latex> contains raw LaTeX whose curly braces would
      // otherwise be parsed as JSX expressions, breaking the build.
      if (id.endsWith(".mdx") || id.endsWith(".md")) {
        if (/<latex>/i.test(code)) {
          return {
            code: code.replace(
              /<latex>([\s\S]*?)<\/latex>/gi,
              (_m, body) => `\n\n$$\n${(body as string).trim()}\n$$\n\n`,
            ),
            map: null,
          };
        }
      }
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

      switch (realId) {
        case VIRTUAL_IDS.manifest:
          return `export const manifest = ${JSON.stringify(manifestToPayload(manifest))};\nexport default manifest;`;
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
      devServer.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const m = url.match(/^\/(images|logo|public|static|assets)\/(.*)$/);
        if (!m) return next();
        const filePath = resolve(userRoot, m[1]!, m[2]!.split("?")[0]!);
        if (!existsSync(filePath)) return next();
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
        };
        if (ext && types[ext]) res.setHeader("Content-Type", types[ext]);
        import("node:fs").then(({ createReadStream }) => {
          createReadStream(filePath).pipe(res);
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
        const filePath = resolve(userRoot, favPath.replace(/^\//, ""));
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

      watcher.on("change", (p: string) => {
        manifest = null;
        invalidateVirtuals(`changed ${p}`);
      });
      watcher.on("add", (p: string) => {
        if (!p.endsWith(".mdx")) return;
        manifest = null;
        invalidateVirtuals(`added ${p}`);
      });
      watcher.on("unlink", (p: string) => {
        if (!p.endsWith(".mdx")) return;
        manifest = null;
        invalidateVirtuals(`removed ${p}`);
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
