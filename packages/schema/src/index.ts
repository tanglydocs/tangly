export const SCHEMA_VERSION = "0.0.1";

export { ColorsSchema, type Colors } from "./colors.js";
export { DocsJsonSchema, parseDocsJson, safeParseDocsJson, type DocsJson } from "./docs-json.js";
export {
  FrontmatterSchema,
  PageModeSchema,
  parseFrontmatter,
  safeParseFrontmatter,
  type Frontmatter,
} from "./frontmatter.js";
export {
  DocsJsonValidationError,
  type FormatDocsJsonErrorOptions,
  formatDocsJsonError,
  formatJsonSyntaxError,
  parseDocsJsonOrThrow,
} from "./format-error.js";
export { generateDocsJsonSchema } from "./json-schema.js";
export { convertMintToDocs, type MintJson } from "./mint-json.js";
export { pagePathForSlug, pageRouteForSlug } from "./page-path.js";
export {
  GlobalNavSchema,
  NavigationSchema,
  type Navigation,
  type NavAnchor,
  type NavDropdown,
  type NavGroup,
  type NavLanguage,
  type NavNode,
  type NavTab,
  type NavVersion,
  openApiDirectory,
  openApiSource,
  type OpenApiRef,
  OpenApiRefSchema,
} from "./navigation.js";
export {
  isPathSafe,
  RefResolutionError,
  readJsonRef,
  resolveJsonPointer,
  resolveRefPath,
} from "./ref-resolve.js";
export { normalizeDocsJson } from "./normalize.js";
export {
  detectPlatform,
  resolveSite,
  type ResolvedSite,
  type ResolveSiteInput,
} from "./resolve-site.js";
export {
  resolveTheme,
  TANGLY_THEMES,
  ThemeSchema,
  type ResolvedTheme,
  type Theme,
} from "./themes.js";
