import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { buildComponentShadowAliases } from "./component-shadow.js";
import { buildTemplateAliases } from "./template-resolver.js";
import { buildThemeStylesAlias, buildUserThemeAliases } from "./theme-resolver.js";
import { tanglyVitePlugin } from "./vite-plugin.js";

// The tangly package version, read from our own package.json (dist/plugin/
// integration.js sits two levels below the package root). Surfaced to the
// runtime as `import.meta.env.TANGLY_VERSION` so the head fragment can emit a
// `<meta name="generator" content="Tangly vX.Y.Z">` tag — lets you identify
// the framework + version of a built site over plain HTTP (curl + grep).
const TANGLY_VERSION: string = (() => {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json");
    return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

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

        // Resolve `@tanglydocs/theme/theme.css` to the active theme's stylesheet
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
            define: {
              "import.meta.env.TANGLY_VERSION": JSON.stringify(TANGLY_VERSION),
            },
            server: {
              fs: {
                allow: [userRoot],
              },
            },
            resolve: {
              alias: {
                "@user": userRoot,
                // Order matters: object-spread later keys win on duplicate
                // keys. Both `shadows` and `userThemeAliases` write
                // `@tanglydocs/theme-ui/components/<Name>.astro`, so the
                // newer (more specific) `theme/components/` overrides
                // must come *after* the legacy `components/` shadows.
                ...themeStylesAlias,
                ...shadows,
                ...userThemeAliases,
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
