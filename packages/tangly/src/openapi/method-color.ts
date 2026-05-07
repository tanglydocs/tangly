/**
 * Hex colors for HTTP method pills shown in the sidebar and endpoint
 * header. Mirrored verbatim by `theme-ui/components/_openapi.ts` —
 * keep both in sync (the duplication is intentional: the manifest
 * builder must not depend on theme-ui).
 */
export function resolveMethodColor(method: string): string {
  switch (method.toLowerCase()) {
    case "get":
      return "#0ea5e9";
    case "post":
      return "#10b981";
    case "put":
      return "#f59e0b";
    case "patch":
      return "#a855f7";
    case "delete":
      return "#ef4444";
    case "options":
    case "head":
      return "#71717a";
    default:
      return "#71717a";
  }
}
