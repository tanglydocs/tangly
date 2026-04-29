export { buildManifest, type BuildManifestOptions } from "./build-manifest.js";
export { type GlossaryEntry, loadGlossary } from "./glossary.js";
export { resolveNavigation, type ResolveResult } from "./resolve-nav.js";
export { readPageFrontmatter, scanPages, type PageOnDisk } from "./scan-pages.js";
export type {
  Manifest,
  ManifestWarning,
  PageEntry,
  ResolvedAnchor,
  ResolvedNavigation,
  ResolvedTab,
  SidebarItem,
} from "./types.js";
