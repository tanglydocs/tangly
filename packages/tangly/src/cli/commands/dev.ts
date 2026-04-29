import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { buildManifest } from "../../manifest/index.js";
import { printBanner } from "../banner.js";
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
    "no-open": {
      type: "boolean",
      description: "Don't open browser",
      default: false,
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
    tunnel: {
      type: "boolean",
      description: "Expose dev server publicly via cloudflared quick tunnel",
      default: false,
    },
  },
  async run({ args }) {
    const userRoot = resolve(args.root);
    const configPath = resolve(userRoot, args.config);

    if (!existsSync(configPath)) {
      console.error(pc.red(`✗ Could not find ${args.config} at ${userRoot}`));
      console.error(pc.dim("  Try `tangly init` to scaffold a new project."));
      process.exit(1);
    }

    // Pre-validate the manifest before launching Astro so the user sees
    // schema errors immediately, not buried in an Astro stack trace.
    const manifest = await buildManifest({ root: userRoot, configFile: args.config });

    process.env.TANGLY_USER_ROOT = userRoot;
    process.env.TANGLY_CONFIG_FILE = args.config;
    process.env.TANGLY_MODE = "dev";

    const runtimeDir = getRuntimeDir();
    const port = Number(args.port);

    const { dev } = (await import("astro")) as typeof import("astro");
    const server = await dev({
      root: runtimeDir,
      logLevel: args.debug ? "info" : "warn",
      server: {
        port,
        host: args.host,
        open: !args["no-open"],
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
