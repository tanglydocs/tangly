// `resolveSite` moved to `@tanglydocs/schema` so theme components can resolve
// SEO URLs without importing `tangly` (which would create a theme-ui ⇄ tangly
// cycle). Re-exported here so tangly's internal callers and the public
// `tangly/site` subpath keep working unchanged.
export {
  detectPlatform,
  resolveSite,
  type ResolvedSite,
  type ResolveSiteInput,
} from "@tanglydocs/schema/site";
