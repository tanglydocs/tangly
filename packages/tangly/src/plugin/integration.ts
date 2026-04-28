import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { tanglyVitePlugin } from "./vite-plugin.js";

export interface TanglyIntegrationOptions {
  /** Absolute path to the user's docs project root. */
  userRoot: string;
  /** docs.json filename — defaults to "docs.json". */
  configFile?: string;
}

export function tanglyIntegration(opts: TanglyIntegrationOptions): AstroIntegration {
  return {
    name: "tangly",
    hooks: {
      "astro:config:setup": ({ updateConfig, addWatchFile, logger }) => {
        const userRoot = opts.userRoot;
        addWatchFile(`${userRoot}/${opts.configFile ?? "docs.json"}`);
        logger.info(`mounting Tangly project at ${userRoot}`);
        // Cast to bypass mismatched Vite versions between Astro and the
        // hoisted vite Tailwind brings in.
        updateConfig({
          vite: {
            plugins: [tanglyVitePlugin(opts)] as never,
            server: {
              fs: {
                allow: [userRoot],
              },
            },
            resolve: {
              alias: {
                "@user": userRoot,
              },
            },
          },
        });
      },
      "astro:config:done": ({ logger }) => {
        logger.info(`Tangly integration ready (${fileURLToPath(import.meta.url)})`);
      },
    },
  };
}
