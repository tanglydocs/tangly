import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { reportConfigError } from "../../manifest/config-error.js";
import { buildManifest } from "../../manifest/index.js";
import { printBanner } from "../banner.js";
import { loadDotenv } from "../load-env.js";
import { getRuntimeDir } from "../runtime-paths.js";
import { findCloudflaredBin, startCloudflaredTunnel } from "../tunnel.js";

export const devCommand = defineCommand({
  meta: {
    name: "dev",
    description: "Start the Tangly dev server with HMR",
  },
  args: {
    port: {
      type: "string",
      description: "Port (default 4321)",
      default: "4321",
    },
    host: {
      type: "boolean",
      description: "Expose on LAN",
      default: false,
    },
    open: {
      type: "boolean",
      description: "Open browser on start (use --no-open to suppress)",
      default: true,
    },
    config: {
      type: "string",
      description: "Path to docs.json (relative to root)",
      default: "docs.json",
    },
    root: {
      type: "string",
      description: "Project root (default cwd)",
      default: ".",
    },
    debug: {
      type: "boolean",
      description: "Verbose logging",
      default: false,
    },
    siteUrl: {
      type: "string",
      description: "Absolute site URL override (default: the dev server origin).",
    },
    env: {
      type: "string",
      description: "Deploy environment: production | preview.",
    },
    tunnel: {
      type: "boolean",
      description: "Expose dev server publicly via cloudflared quick tunnel",
      default: false,
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const configPath = resolve(userRoot, args.config);

    loadDotenv(userRoot);

    if (!existsSync(configPath)) {
      console.error(pc.red(`✗ Could not find ${args.config} at ${userRoot}`));
      console.error(pc.dim("  Try `tangly init` to scaffold a new project."));
      process.exit(1);
    }

    // Set mode/overrides before building the manifest so its social-card
    // warning knows we're in dev (cards render live via the request origin).
    process.env.TANGLY_MODE = "dev";
    if (args.env && args.env !== "production" && args.env !== "preview") {
      console.error(pc.red(`✗ Unknown --env "${args.env}". Expected: production | preview.`));
      process.exit(1);
    }
    if (args.siteUrl) process.env.TANGLY_SITE_URL = args.siteUrl;
    if (args.env) process.env.TANGLY_ENV = args.env;

    // Pre-validate the manifest before launching Astro so the user sees
    // schema errors immediately, not buried in an Astro stack trace.
    let manifest: Awaited<ReturnType<typeof buildManifest>>;
    try {
      manifest = await buildManifest({ root: userRoot, configFile: args.config });
    } catch (err) {
      if (reportConfigError(err)) process.exit(1);
      throw err;
    }

    process.env.TANGLY_USER_ROOT = userRoot;
    process.env.TANGLY_CONFIG_FILE = args.config;

    const runtimeDir = getRuntimeDir();
    const port = Number(args.port);

    const { dev } = (await import("astro")) as typeof import("astro");
    const server = await dev({
      root: runtimeDir,
      logLevel: args.debug ? "info" : "warn",
      server: {
        port,
        // Bind explicit IPv4 so reverse proxies that resolve `localhost`
        // to 127.0.0.1 don't hit ECONNREFUSED when Node prefers ::1.
        host: args.host ? "0.0.0.0" : "127.0.0.1",
        open: args.open,
      },
      vite: {
        server: { open: args.open },
      },
    } as never);

    printBanner({
      version: VERSION,
      projectName: manifest.config.name,
      pageCount: manifest.pages.size,
      themeName: manifest.config.theme ?? "tang",
      localUrl: `http://localhost:${port}`,
      networkUrl: args.host ? `http://0.0.0.0:${port}` : undefined,
    });

    if (manifest.warnings.length > 0) {
      console.log(pc.yellow(`  ${manifest.warnings.length} warning(s):`));
      for (const w of manifest.warnings.slice(0, 10)) {
        console.log(pc.dim(`    • ${w.message}`));
      }
    }

    let tunnelChild: ReturnType<typeof startCloudflaredTunnel>["child"] | null = null;
    if (args.tunnel) {
      const bin = findCloudflaredBin();
      if (!bin) {
        console.log(
          pc.yellow(
            "⚠ --tunnel requires cloudflared. Install it (e.g. `brew install cloudflared`) and re-run.",
          ),
        );
      } else {
        const { child, url } = startCloudflaredTunnel({
          bin,
          localUrl: `http://localhost:${port}`,
        });
        tunnelChild = child;
        url
          .then((publicUrl) => {
            console.log(pc.cyan(`\n🌐 Public tunnel: ${publicUrl}\n`));
          })
          .catch(() => {
            /* swallow */
          });
        child.on("exit", (code) => {
          if (code !== 0 && code !== null) {
            console.log(pc.dim(`cloudflared exited (code ${code}).`));
          }
        });
      }
    }

    process.on("SIGINT", async () => {
      tunnelChild?.kill("SIGTERM");
      await (server as { stop?: () => Promise<void> }).stop?.();
      process.exit(0);
    });
  },
});
