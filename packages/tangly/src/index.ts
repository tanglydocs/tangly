import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolves to packages/tangly/package.json at runtime — dist/index.js sits one level
// below the package root, so `../package.json` works for both built + linked installs.
const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

export const VERSION: string = pkg.version;

export {
  buildManifest,
  type BuildManifestOptions,
  type GlossaryEntry,
  loadGlossary,
  resolveNavigation,
  type ResolveResult,
  scanPages,
  readPageFrontmatter,
  type PageOnDisk,
} from "./manifest/index.js";

export type {
  Manifest,
  ManifestWarning,
  PageEntry,
  ResolvedAnchor,
  ResolvedNavigation,
  ResolvedTab,
  SidebarItem,
} from "./manifest/types.js";

export {
  detectPlatform,
  resolveSite,
  type ResolvedSite,
  type ResolveSiteInput,
} from "./site/resolve-site.js";
