import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { resolveTheme, type ResolvedTheme } from "@tangly/schema";

const nodeRequire = createRequire(import.meta.url);

/**
 * Locate the on-disk root of an `@tangly/theme-*` package via Node's
 * package resolver. Works in both monorepo (workspace symlink) and
 * installed (real `node_modules`) layouts. Each theme package exports
 * `./package.json` so this resolves cleanly.
 */
function resolveThemePackageRoot(specifier: string): string {
  const pkgJson = nodeRequire.resolve(`${specifier}/package.json`);
  return dirname(pkgJson);
}

/**
 * Component names that the user can shadow under `<userRoot>/theme/components/`.
 * Mirrors the list in component-shadow.ts.
 */
const SHADOWABLE_COMPONENT_NAMES = [
  "Accordion",
  "AccordionGroup",
  "Badge",
  "Card",
  "CardGroup",
  "Check",
  "CodeGroup",
  "Columns",
  "Danger",
  "Embed",
  "Expandable",
  "Frame",
  "Icon",
  "Info",
  "Note",
  "OpenApiEndpoint",
  "ParamField",
  "RequestExample",
  "ResponseExample",
  "ResponseField",
  "Snippet",
  "Step",
  "Steps",
  "Tab",
  "Tabs",
  "Tip",
  "Tooltip",
  "Update",
  "Warning",
] as const;

/**
 * Top-level theme files (Layout, PageShell, etc.) that the user can
 * override by dropping a same-named file at `<userRoot>/theme/<Name>.astro`.
 */
const SHADOWABLE_LAYOUT_NAMES = [
  "Layout",
  "PageShell",
  "Sidebar",
  "TopNav",
  "Footer",
  "SearchModal",
] as const;

const EXTENSIONS = [".astro", ".tsx", ".jsx", ".ts", ".js"] as const;

/**
 * Build the alias map that points `@tangly/theme/theme.css` at the active
 * theme's CSS file (theme-tang or theme-pith). The user's
 * `<userRoot>/theme/styles/theme.css` wins over both when present.
 */
export function buildThemeStylesAlias(
  userRoot: string,
  configFile: string,
): Record<string, string> {
  const aliases: Record<string, string> = {};

  // Read docs.json to discover the active theme. resolveTheme() collapses
  // any unrecognised string into the default Tangly theme.
  let activeTheme: ResolvedTheme = "tang";
  try {
    const path = resolve(userRoot, configFile);
    if (existsSync(path)) {
      const cfg = JSON.parse(readFileSync(path, "utf8")) as { theme?: string };
      activeTheme = resolveTheme(cfg.theme);
    }
  } catch {
    // ignore — fall through to default "tang"
  }

  // Resolve via the theme package's own export of `./package.json` so we
  // get a real on-disk path in both monorepo and installed layouts.
  const themePkgRoot = resolveThemePackageRoot(`@tangly/theme-${activeTheme}`);
  const themeCssPath = resolve(themePkgRoot, "src", "styles", "theme.css");

  // User override wins.
  const userThemeCss = resolve(userRoot, "theme", "styles", "theme.css");
  aliases["@tangly/theme/theme.css"] = existsSync(userThemeCss) ? userThemeCss : themeCssPath;

  // Shell overrides shipped by the theme package itself. When `theme-pith`
  // (or any future theme) provides its own Layout/Sidebar/PageShell etc.,
  // alias the shared `@tangly/theme-ui/<Name>.astro` specifier at it. The
  // user's `<userRoot>/theme/<Name>.astro` (added later by
  // buildUserThemeAliases) still wins because it's spread after.
  for (const name of SHADOWABLE_LAYOUT_NAMES) {
    const candidate = resolve(themePkgRoot, "src", `${name}.astro`);
    if (existsSync(candidate)) {
      aliases[`@tangly/theme-ui/${name}.astro`] = candidate;
    }
  }

  return aliases;
}

/**
 * Cascade of public-asset roots for the active theme, ordered most → least
 * specific. Used by both the dev middleware and the build-time copy step.
 *
 *   <userRoot>                   (project's own /images, /logo, etc.)
 *   <userRoot>/theme/public      (project's per-theme override)
 *   <activeTheme>/public         (theme-tang or theme-pith bundled assets)
 *   <theme-ui>/public            (shared baseline assets)
 *
 * Only roots that exist are returned. Keeping this in `theme-resolver` so
 * package-root lookup logic lives in one place.
 */
export function buildPublicCascade(userRoot: string, themeName: string | undefined): string[] {
  const roots: string[] = [userRoot];

  const userThemePublic = resolve(userRoot, "theme", "public");
  if (existsSync(userThemePublic)) roots.push(userThemePublic);

  const active = resolveTheme(themeName);
  const activeThemePublic = resolve(resolveThemePackageRoot(`@tangly/theme-${active}`), "public");
  if (existsSync(activeThemePublic)) roots.push(activeThemePublic);

  const themeUiPublic = resolve(resolveThemePackageRoot("@tangly/theme-ui"), "public");
  if (existsSync(themeUiPublic)) roots.push(themeUiPublic);

  return roots;
}

/**
 * Build alias map for `<userRoot>/theme/components/<Name>.{astro,tsx,...}`
 * and `<userRoot>/theme/<Name>.{astro,...}` overrides of theme-ui shells.
 *
 * Resolution: drop a file at `<userRoot>/theme/components/Card.astro` to
 * override `@tangly/theme-ui/components/Card.astro` everywhere it's
 * imported. Drop `<userRoot>/theme/Layout.astro` to swap the page shell.
 */
export function buildUserThemeAliases(userRoot: string): Record<string, string> {
  const themeDir = resolve(userRoot, "theme");
  if (!existsSync(themeDir)) return {};

  const aliases: Record<string, string> = {};

  // Component overrides: <userRoot>/theme/components/<Name>.<ext>
  const componentsDir = resolve(themeDir, "components");
  if (existsSync(componentsDir)) {
    for (const name of SHADOWABLE_COMPONENT_NAMES) {
      for (const ext of EXTENSIONS) {
        const candidate = resolve(componentsDir, `${name}${ext}`);
        if (existsSync(candidate)) {
          aliases[`@tangly/theme-ui/components/${name}.astro`] = candidate;
          break;
        }
      }
    }
  }

  // Top-level layout overrides: <userRoot>/theme/<Name>.<ext>
  for (const name of SHADOWABLE_LAYOUT_NAMES) {
    for (const ext of EXTENSIONS) {
      const candidate = resolve(themeDir, `${name}${ext}`);
      if (existsSync(candidate)) {
        aliases[`@tangly/theme-ui/${name}.astro`] = candidate;
        break;
      }
    }
  }

  return aliases;
}
