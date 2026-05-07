/**
 * Resolve the auth scheme to surface in the playground. Caller-provided
 * frontmatter / docs.json props win; otherwise we look at the operation's
 * `security` block plus the spec's `securitySchemes` to make an educated
 * label.
 */

import type { OpenApiOp, SecurityScheme } from "./_spec-loader.ts";

export type AuthMethod = "bearer" | "basic" | "key" | "none";

export interface ResolvedAuth {
  method: AuthMethod;
  /** Header / query param name (when method=key). */
  name?: string;
  /** Human-readable label rendered above the input. */
  label: string;
  /** Helper text under the input. */
  hint?: string;
}

export function resolveAuth(args: {
  op: OpenApiOp | null;
  schemes: Record<string, SecurityScheme>;
  /** Override: docs.json `api.auth.method` or frontmatter `authMethod`. */
  override?: AuthMethod;
  overrideName?: string;
}): ResolvedAuth {
  if (args.override && args.override !== "none") {
    return labelFor(args.override, args.overrideName);
  }
  const inferred = inferFromSpec(args.op, args.schemes);
  if (inferred) return inferred;
  return labelFor("none");
}

function inferFromSpec(
  op: OpenApiOp | null,
  schemes: Record<string, SecurityScheme>,
): ResolvedAuth | null {
  const required = op?.security ?? [];
  for (const requirement of required) {
    for (const name of Object.keys(requirement)) {
      const s = schemes[name];
      if (!s) continue;
      if (s.type === "http" && s.scheme === "bearer") {
        return labelFor("bearer");
      }
      if (s.type === "http" && s.scheme === "basic") {
        return labelFor("basic");
      }
      if (s.type === "apiKey") {
        return labelFor("key", s.name ?? "X-API-Key");
      }
    }
  }
  return null;
}

function labelFor(method: AuthMethod, name?: string): ResolvedAuth {
  switch (method) {
    case "bearer":
      return {
        method,
        label: "Bearer token",
        hint: "Sent as `Authorization: Bearer <token>`",
      };
    case "basic":
      return {
        method,
        label: "Basic auth",
        hint: "Format: `user:pass` (base64-encoded automatically)",
      };
    case "key":
      return {
        method,
        ...(name ? { name } : {}),
        label: `API key (${name ?? "X-API-Key"})`,
      };
    case "none":
    default:
      return { method: "none", label: "" };
  }
}
