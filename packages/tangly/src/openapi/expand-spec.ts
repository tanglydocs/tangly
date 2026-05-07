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

export interface CodeSample {
  lang: string;
  label?: string;
  source: string;
}

export interface OpenApiOperation {
  method: Method;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  /** `x-codeSamples` / `x-code-samples` from the spec. */
  codeSamples?: CodeSample[];
  /** `x-hidden`: page is built and routable but suppressed from sidebar. */
  hidden?: boolean;
  /** `x-excluded`: page is omitted entirely. Filtered before manifest insert. */
  excluded?: boolean;
  /** Names of `securitySchemes` that apply to this operation. */
  security?: string[];
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
  components?: {
    securitySchemes?: Record<string, unknown>;
  };
}

interface RawOp {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  security?: Array<Record<string, unknown>>;
  "x-codeSamples"?: unknown;
  "x-code-samples"?: unknown;
  "x-hidden"?: boolean;
  "x-excluded"?: boolean;
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
      const codeSamples = parseCodeSamples(op["x-codeSamples"] ?? op["x-code-samples"]);
      const security = parseSecurity(op.security);
      const operationData: OpenApiOperation = {
        method,
        path,
        ...(op.summary !== undefined && { summary: op.summary }),
        ...(op.description !== undefined && { description: op.description }),
        ...(op.tags !== undefined && { tags: op.tags }),
        ...(op.operationId !== undefined && { operationId: op.operationId }),
        ...(codeSamples && codeSamples.length > 0 && { codeSamples }),
        ...(op["x-hidden"] === true && { hidden: true }),
        ...(op["x-excluded"] === true && { excluded: true }),
        ...(security && security.length > 0 && { security }),
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

function parseCodeSamples(raw: unknown): CodeSample[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CodeSample[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const lang = typeof e.lang === "string" ? e.lang : undefined;
    const source = typeof e.source === "string" ? e.source : undefined;
    if (!lang || !source) continue;
    out.push({
      lang,
      source,
      ...(typeof e.label === "string" && { label: e.label }),
    });
  }
  return out;
}

function parseSecurity(raw: RawOp["security"]): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const names = new Set<string>();
  for (const req of raw) {
    if (!req || typeof req !== "object") continue;
    for (const k of Object.keys(req)) names.add(k);
  }
  return names.size > 0 ? [...names] : undefined;
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
