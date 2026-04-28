import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { buildComponentShadowAliases } from "./component-shadow.js";
import { buildTemplateAliases } from "./template-resolver.js";
import { tanglyVitePlugin } from "./vite-plugin.js";

function resolveThemeAliases(userRoot: string, configFile: string): Record<string, string> {
  try {
    const path = resolve(userRoot, configFile);
    if (!existsSync(path)) return {};
    const cfg = JSON.parse(readFileSync(path, "utf8")) as { theme?: string };
    if (cfg.theme === "pith") {
      // Map every @tangly/theme-tang/<x> import to @tangly/theme-pith/<x>.
      return {
        "@tangly/theme-tang": "@tangly/theme-pith",
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export interface TanglyIntegrationOptions {
  /** Absolute path to the user's docs project root. */
  userRoot: string;
  /** docs.json filename — defaults to "docs.json". */
  configFile?: string;
  /** Keep draft pages in the manifest (dev: true, build: false unless env). */
  includeDrafts?: boolean;
}

export function tanglyIntegration(opts: TanglyIntegrationOptions): AstroIntegration {
  return {
    name: "tangly",
    hooks: {
      "astro:config:setup": ({ updateConfig, addWatchFile, logger }) => {
        const userRoot = opts.userRoot;
        addWatchFile(`${userRoot}/${opts.configFile ?? "docs.json"}`);
        logger.info(`mounting Tangly project at ${userRoot}`);

        const shadows = buildComponentShadowAliases(userRoot);
        const shadowCount = Object.keys(shadows).length;
        if (shadowCount > 0) {
          logger.info(`component shadowing: ${shadowCount} override(s) detected`);
        }
        const templateAliases = buildTemplateAliases(userRoot);

        // Theme switching: read docs.json once (synchronously) to discover
        // the active theme. When set to "pith", alias all imports of
        // @tangly/theme-tang → @tangly/theme-pith so the runtime swaps
        // themes without code changes.
        const themeAliases = resolveThemeAliases(userRoot, opts.configFile ?? "docs.json");

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
                ...themeAliases,
                ...shadows,
                ...templateAliases,
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
