export const VERSION = "0.0.1";

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
