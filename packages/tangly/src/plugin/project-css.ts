import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * Mintlify includes every `.css` file in the content directory (the folder
 * holding docs.json) on every page. This finds them for Tangly.
 *
 * Rules:
 * - recursive from the project root;
 * - skips dot-directories, `node_modules`, `dist`, `.tangly`/`.astro` output;
 * - skips the static asset dirs Tangly serves as raw files (`public`,
 *   `static`, `assets`, `images`, `logo`) at the project root: CSS there is
 *   a file to link to, not site CSS;
 * - skips `theme/styles/theme.css`, which is already the full theme
 *   replacement;
 * - sorted by posix-style relative path (code-unit order), so the cascade is
 *   deterministic across machines.
 */
const SKIP_DIRS_ANYWHERE = new Set(["node_modules", "dist"]);
const SKIP_DIRS_AT_ROOT = new Set(["public", "static", "assets", "images", "logo"]);
const THEME_OVERRIDE = "theme/styles/theme.css";

export function discoverProjectCss(userRoot: string): string[] {
  const root = resolve(userRoot);
  const found: string[] = [];

  const walk = (dir: string, atRoot: boolean): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        if (SKIP_DIRS_ANYWHERE.has(entry.name)) continue;
        if (atRoot && SKIP_DIRS_AT_ROOT.has(entry.name)) continue;
        walk(full, false);
      } else if (entry.isFile() && entry.name.endsWith(".css")) {
        found.push(relative(root, full).split(sep).join("/"));
      }
    }
  };
  walk(root, true);

  return found
    .filter((rel) => rel !== THEME_OVERRIDE)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((rel) => resolve(root, rel));
}

const TAILWIND_ENTRY = /@import\s+["']tailwindcss(?:\/[^"']*)?["']/;

/**
 * Split discovered files into those safe to `@import` and those that pull in
 * Tailwind themselves. The theme already ships Tailwind, and a second entry
 * would both duplicate preflight/utilities and fail to resolve `tailwindcss`
 * from the user's project, so such files are skipped (and reported).
 */
export function partitionTailwindEntries(files: string[]): { ok: string[]; skipped: string[] } {
  const ok: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    let code = "";
    try {
      code = readFileSync(f, "utf8");
    } catch {
      /* unreadable: let the bundler report it */
    }
    (TAILWIND_ENTRY.test(code) ? skipped : ok).push(f);
  }
  return { ok, skipped };
}

/** Virtual module id every theme shell imports (injected, see below). */
export const PROJECT_CSS_ID = "virtual:tangly/project.css";

/**
 * Body of the virtual CSS module: one `@import` per project file, in
 * discovery order. Vite tracks the imported files, so edits hot-update.
 */
export function projectCssModule(files: string[]): string {
  const lines = files.map((f) => `@import ${JSON.stringify(f.replace(/\\/g, "/"))};`);
  return `${lines.join("\n")}\n`;
}

const THEME_CSS_IMPORT = /import\s+["']@tanglydocs\/theme\/theme\.css["']/;

/**
 * For a compiled `.astro` shell (Astro compiles before our transform hook
 * runs, so we see ES imports) that imports the theme stylesheet, append the
 * project CSS import after every other import: CSS order follows import
 * order. Returns `code` unchanged for any other file (or one already done).
 */
export function injectProjectCssImport(code: string): string {
  if (!THEME_CSS_IMPORT.test(code) || code.includes(PROJECT_CSS_ID)) return code;
  return `${code}\nimport ${JSON.stringify(PROJECT_CSS_ID)};\n`;
}
