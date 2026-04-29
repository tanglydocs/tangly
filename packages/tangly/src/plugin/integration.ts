import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { buildComponentShadowAliases } from "./component-shadow.js";
import { buildTemplateAliases } from "./template-resolver.js";
import { buildThemeStylesAlias, buildUserThemeAliases } from "./theme-resolver.js";
import { tanglyVitePlugin } from "./vite-plugin.js";

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
        const configFile = opts.configFile ?? "docs.json";
        addWatchFile(`${userRoot}/${configFile}`);
        logger.info(`mounting Tangly project at ${userRoot}`);

        const shadows = buildComponentShadowAliases(userRoot);
        const shadowCount = Object.keys(shadows).length;
        if (shadowCount > 0) {
          logger.info(`component shadowing: ${shadowCount} override(s) detected`);
        }
        const templateAliases = buildTemplateAliases(userRoot);

        // Resolve `@tangly/theme/theme.css` to the active theme's stylesheet
        // (theme-tang or theme-pith), or `<userRoot>/theme/styles/theme.css`
        // if the user supplies one.
        const themeStylesAlias = buildThemeStylesAlias(userRoot, configFile);

        // Per-component / per-shell overrides at `<userRoot>/theme/...`.
        const userThemeAliases = buildUserThemeAliases(userRoot);

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
                // Order matters: user overrides first, then theme styles,
                // then deprecated shadow map (also user-driven), then
                // template alias.
                ...userThemeAliases,
                ...themeStylesAlias,
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
