/**
 * Resolve and load an OpenAPI spec at SSR time. URL → fetch.
 * Local path → read from <userRoot>. Returns the operation, the spec
 * servers, and the spec's `securitySchemes` block.
 *
 * Mirrors the loader in `tangly/src/openapi/expand-spec.ts` —
 * theme-ui must not depend on the tangly app package, so the logic
 * is duplicated. Keep both in sync if the resolver changes.
 */

export interface OpenApiOp {
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in?: string;
    description?: string;
    required?: boolean;
    schema?: { type?: string; example?: unknown };
    example?: unknown;
  }>;
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { example?: unknown; schema?: unknown }>;
    }
  >;
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: unknown; example?: unknown }>;
  };
  security?: Array<Record<string, unknown>>;
  /** Aggregated `x-codeSamples` / `x-code-samples` from the spec. */
  codeSamples?: Array<{ lang: string; label?: string; source: string }>;
}

export interface SecurityScheme {
  type?: string;
  scheme?: string;
  in?: string;
  name?: string;
  description?: string;
}

export interface LoadedSpec {
  op: OpenApiOp | null;
  servers: string[];
  securitySchemes: Record<string, SecurityScheme>;
  loadError: string | null;
}

interface RawSpec {
  paths?: Record<string, Record<string, OpenApiOp>>;
  servers?: Array<{ url?: string }>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
    schemas?: Record<string, unknown>;
  };
}

export async function loadSpec(spec: string, method: string, path: string): Promise<LoadedSpec> {
  let doc: RawSpec = {};
  let loadError: string | null = null;
  try {
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
      const res = await fetch(spec, { redirect: "follow" });
      if (!res.ok) {
        loadError = `${res.status} ${res.statusText}`;
      } else {
        doc = (await res.json()) as RawSpec;
      }
    } else {
      const userRoot = process.env.TANGLY_USER_ROOT ?? "";
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const abs = resolve(userRoot, spec.replace(/^\/+/, ""));
      const raw = await readFile(abs, "utf8");
      doc = JSON.parse(raw) as RawSpec;
    }
  } catch (err) {
    loadError = `Failed to load ${spec}: ${(err as Error).message}`;
  }

  const methodLower = method.toLowerCase();
  const rawOp = doc.paths?.[path]?.[methodLower] ?? null;
  if (!loadError && !rawOp) {
    loadError = `No operation found for ${methodLower.toUpperCase()} ${path}`;
  }
  const dereffed = rawOp
    ? (dereference(rawOp, doc as unknown as Record<string, unknown>) as OpenApiOp)
    : null;
  const op = dereffed ? attachCodeSamples(dereffed) : null;
  const servers = (doc.servers ?? [])
    .map((s) => s.url ?? "")
    .filter((u): u is string => u.length > 0);
  const securitySchemes = doc.components?.securitySchemes ?? {};

  return { op, servers, securitySchemes, loadError };
}

/**
 * Walk the value and inline any `{$ref: "#/components/..."}`. Cycles are
 * detected by tracking visited pointers; a cycle is replaced with a
 * `{ $circular: true }` marker so downstream renderers can short-circuit.
 *
 * Only `#`-prefixed (internal) refs are resolved. External refs are
 * left as-is.
 */
function dereference<T>(
  node: T,
  root: Record<string, unknown>,
  seen: Set<string> = new Set(),
): unknown {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((v) => dereference(v, root, seen));
  const obj = node as Record<string, unknown>;
  const ref = typeof obj.$ref === "string" ? obj.$ref : null;
  if (ref && ref.startsWith("#/")) {
    if (seen.has(ref)) return { $circular: true, $ref: ref };
    const resolved = resolvePointer(root, ref);
    if (resolved === undefined) return { $unresolved: true, $ref: ref };
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    return dereference(resolved, root, nextSeen);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = dereference(v, root, seen);
  return out;
}

function resolvePointer(root: Record<string, unknown>, ref: string): unknown {
  const parts = ref
    .slice(2)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function attachCodeSamples(op: OpenApiOp): OpenApiOp {
  const raw =
    (op as Record<string, unknown>)["x-codeSamples"] ??
    (op as Record<string, unknown>)["x-code-samples"];
  if (!Array.isArray(raw)) return op;
  const samples: NonNullable<OpenApiOp["codeSamples"]> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const lang = typeof e.lang === "string" ? e.lang : undefined;
    const source = typeof e.source === "string" ? e.source : undefined;
    if (!lang || !source) continue;
    samples.push({
      lang,
      source,
      ...(typeof e.label === "string" && { label: e.label }),
    });
  }
  return samples.length > 0 ? { ...op, codeSamples: samples } : op;
}
