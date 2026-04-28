import { readFileSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve } from "node:path";

export class RefResolutionError extends Error {
  constructor(
    message: string,
    public ref: string,
    public location: string,
  ) {
    super(`${message} (ref: ${ref} at ${location})`);
    this.name = "RefResolutionError";
  }
}

export function isPathSafe(target: string, root: string): boolean {
  const abs = resolve(root, target);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return false;
  return true;
}

export interface ResolveRefOptions {
  root: string;
  source: string;
}

export function resolveRefPath(ref: string, opts: ResolveRefOptions): string {
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    throw new RefResolutionError("remote $refs are not allowed", ref, opts.source);
  }
  const [pathPart] = ref.split("#") as [string, ...string[]];
  if (!pathPart) {
    throw new RefResolutionError("$ref must include a path", ref, opts.source);
  }
  if (isAbsolute(pathPart)) {
    throw new RefResolutionError("absolute paths in $ref are not allowed", ref, opts.source);
  }
  const normalized = normalize(pathPart);
  if (!isPathSafe(normalized, opts.root)) {
    throw new RefResolutionError("$ref escapes project root", ref, opts.source);
  }
  return resolve(opts.root, normalized);
}

export function resolveJsonPointer(doc: unknown, pointer: string): unknown {
  if (!pointer || pointer === "#" || pointer === "#/") return doc;
  const path = pointer.replace(/^#?\//, "").split("/");
  let cur: unknown = doc;
  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined;
    const key = decodeURIComponent(seg.replace(/~1/g, "/").replace(/~0/g, "~"));
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function readJsonRef(ref: string, opts: ResolveRefOptions): unknown {
  const filePath = resolveRefPath(ref, opts);
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const fragment = ref.includes("#") ? ref.slice(ref.indexOf("#")) : "";
  return fragment ? resolveJsonPointer(parsed, fragment) : parsed;
}
