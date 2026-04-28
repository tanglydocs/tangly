/**
 * Phase 3: expand an OpenAPI spec into per-endpoint synthesized pages.
 *
 * When a tab in `docs.json` carries an `openapi` field (or top-level
 * `api.openapi` is set) but there are no per-endpoint MDX files, Tangly
 * generates one logical page per (method, path) pair. Each becomes a
 * navigable URL the runtime renders via OpenApiEndpoint.
 *
 * The output of `expandOpenApiSpec` is consumed by the manifest builder
 * to extend `pages` with synthesized entries. The runtime then routes
 * them through the same catch-all that handles MDX pages.
 */

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head", "trace"] as const;
type Method = (typeof HTTP_METHODS)[number];

export interface OpenApiOperation {
  method: Method;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
}

export interface ExpandedSpec {
  /** Logical slug under the tab's slug, e.g. "api-reference/get-users-id". */
  operations: Array<{
    /** Normalized slug (no leading slash). */
    slug: string;
    /** Pretty title (op.summary || method+path). */
    title: string;
    /** First tag (used for sidebar group). */
    group?: string;
    op: OpenApiOperation;
  }>;
  /** spec.info.title etc. */
  info?: { title?: string; description?: string };
}

interface RawSpec {
  info?: { title?: string; description?: string };
  paths?: Record<string, Record<string, RawOp>>;
}

interface RawOp {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
}

export function isHttpMethod(s: string): s is Method {
  return (HTTP_METHODS as readonly string[]).includes(s.toLowerCase());
}

export function expandOpenApiSpec(spec: RawSpec, opts: { prefix?: string } = {}): ExpandedSpec {
  const operations: ExpandedSpec["operations"] = [];
  const prefix = opts.prefix ?? "";
  if (!spec.paths) return { operations };

  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [methodLower, op] of Object.entries(ops)) {
      if (!isHttpMethod(methodLower)) continue;
      const method = methodLower as Method;
      const operationData: OpenApiOperation = {
        method,
        path,
        ...(op.summary !== undefined && { summary: op.summary }),
        ...(op.description !== undefined && { description: op.description }),
        ...(op.tags !== undefined && { tags: op.tags }),
        ...(op.operationId !== undefined && { operationId: op.operationId }),
      };
      const slug = synthesizeSlug({ method, path, operationId: op.operationId, prefix });
      const title = op.summary ?? `${method.toUpperCase()} ${path}`;
      const tag = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags[0] : undefined;
      operations.push({
        slug,
        title,
        ...(tag !== undefined && { group: tag }),
        op: operationData,
      });
    }
  }
  return { operations, ...(spec.info && { info: spec.info }) };
}

function synthesizeSlug(args: {
  method: Method;
  path: string;
  operationId?: string;
  prefix: string;
}): string {
  // Prefer operationId for stability when available.
  if (args.operationId) {
    const op = args.operationId
      .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return joinSlug(args.prefix, op);
  }
  // Fallback: method-path-segments. Strip path-parameter braces.
  const cleanPath = args.path
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return joinSlug(args.prefix, `${args.method}-${cleanPath}`);
}

function joinSlug(prefix: string, suffix: string): string {
  if (!prefix) return suffix;
  return `${prefix.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

/**
 * Try to load and parse an OpenAPI spec from a URL or local path. Returns
 * null on failure (the caller adds a manifest warning).
 */
export async function loadOpenApiSpec(spec: string, root: string): Promise<RawSpec | null> {
  try {
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
      const res = await fetch(spec, { redirect: "follow" });
      if (!res.ok) return null;
      return (await res.json()) as RawSpec;
    }
    // Local file path resolved against project root.
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const abs = resolve(root, spec.replace(/^\/+/, ""));
    const raw = await readFile(abs, "utf8");
    return JSON.parse(raw) as RawSpec;
  } catch {
    return null;
  }
}
