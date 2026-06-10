import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { applyMdxSourceCompat } from "../plugin/mdx-source-compat.js";
import type { Manifest } from "../manifest/types.js";

/**
 * Check-time MDX validation.
 *
 * `tangly check` historically validated config + frontmatter only, so a page
 * that parses as MDX but references an unbound identifier — the classic
 * Mintlify-corpus footgun of literal `{snake_case}` placeholders in prose —
 * passed check and then killed `tangly build` with a ReferenceError at
 * prerender. Two layers close that gap:
 *
 *   1. **Parse** every page with the real MDX parser (same source-compat
 *      rewrites the build applies). Catches syntax errors: unclosed JSX
 *      tags, malformed expressions, bad ESM.
 *   2. **Scope-walk** every JSX expression's estree for identifiers that
 *      nothing binds — not the file's imports/exports, not the expression's
 *      own params/declarations, not the MDX-provided names, not JS globals.
 *      Those are guaranteed ReferenceErrors at render time.
 *
 * Pages only — `/snippets` files legitimately reference bare identifiers
 * (Mintlify reusable snippets take `{props}`-style variables from the
 * importing page), so they are never scanned.
 */

export interface MdxIssue {
  /** Path relative to the project root. */
  file: string;
  line?: number;
  column?: number;
  message: string;
  hint?: string;
}

/** Names MDX/Astro provide to every compiled page at render time. */
const MDX_PROVIDED = new Set(["props", "components", "frontmatter"]);

/** JS globals legitimately reachable from a prerendered MDX expression. */
const JS_GLOBALS = new Set([
  "Array",
  "ArrayBuffer",
  "BigInt",
  "Boolean",
  "Date",
  "Error",
  "Infinity",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "Reflect",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "WeakMap",
  "WeakSet",
  "console",
  "crypto",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "fetch",
  "globalThis",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "structuredClone",
  "undefined",
]);

// Minimal estree shape — @types/estree isn't a dependency and the walker
// only needs `type` + dynamic child access.
type EstreeNode = { type: string; [key: string]: unknown };

interface Scope {
  bindings: Set<string>;
  parent: Scope | null;
}

function scopeHas(scope: Scope | null, name: string): boolean {
  for (let s = scope; s; s = s.parent) {
    if (s.bindings.has(name)) return true;
  }
  return false;
}

/** Collect every name bound by a destructuring pattern / param / declarator id. */
function collectPatternNames(node: EstreeNode | null | undefined, into: Set<string>): void {
  if (!node || typeof node.type !== "string") return;
  switch (node.type) {
    case "Identifier":
      into.add(node.name as string);
      return;
    case "ObjectPattern":
      for (const p of (node.properties as EstreeNode[]) ?? []) {
        if (p.type === "Property") collectPatternNames(p.value as EstreeNode, into);
        else if (p.type === "RestElement") collectPatternNames(p.argument as EstreeNode, into);
      }
      return;
    case "ArrayPattern":
      for (const el of (node.elements as (EstreeNode | null)[]) ?? []) {
        collectPatternNames(el, into);
      }
      return;
    case "AssignmentPattern":
      collectPatternNames(node.left as EstreeNode, into);
      return;
    case "RestElement":
      collectPatternNames(node.argument as EstreeNode, into);
      return;
    default:
      return;
  }
}

interface FreeRef {
  name: string;
  line?: number;
  column?: number;
}

/**
 * Walk an estree fragment collecting identifiers in *reference* position
 * that no enclosing scope binds. Handles the expression shapes that occur
 * in real MDX: member chains, calls with arrow callbacks, template
 * literals, object/array literals, conditionals, and inline JSX.
 */
function walkForFreeRefs(node: EstreeNode | null | undefined, scope: Scope, refs: FreeRef[]): void {
  if (!node || typeof node !== "object" || typeof node.type !== "string") return;

  const walk = (child: unknown): void => {
    if (Array.isArray(child)) {
      for (const c of child) walkForFreeRefs(c as EstreeNode, scope, refs);
    } else {
      walkForFreeRefs(child as EstreeNode, scope, refs);
    }
  };

  switch (node.type) {
    case "Identifier": {
      const name = node.name as string;
      if (!scopeHas(scope, name)) {
        const loc = (node.loc as { start?: { line: number; column: number } } | undefined)?.start;
        refs.push({ name, line: loc?.line, column: loc ? loc.column + 1 : undefined });
      }
      return;
    }
    case "MemberExpression":
      walk(node.object);
      if (node.computed) walk(node.property);
      return;
    case "Property":
      if (node.computed) walk(node.key);
      walk(node.value);
      return;
    case "MethodDefinition":
    case "PropertyDefinition":
      if (node.computed) walk(node.key);
      walk(node.value);
      return;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration": {
      const inner: Scope = { bindings: new Set(), parent: scope };
      if (node.id) collectPatternNames(node.id as EstreeNode, inner.bindings);
      for (const p of (node.params as EstreeNode[]) ?? []) {
        collectPatternNames(p, inner.bindings);
      }
      walkForFreeRefs(node.body as EstreeNode, inner, refs);
      return;
    }
    case "BlockStatement": {
      const inner: Scope = { bindings: new Set(), parent: scope };
      for (const stmt of (node.body as EstreeNode[]) ?? []) {
        walkForFreeRefs(stmt, inner, refs);
      }
      return;
    }
    case "VariableDeclaration":
      for (const d of (node.declarations as EstreeNode[]) ?? []) {
        // Bind first so self/sequential references resolve, then walk init.
        collectPatternNames(d.id as EstreeNode, scope.bindings);
        walkForFreeRefs(d.init as EstreeNode, scope, refs);
      }
      return;
    case "CatchClause": {
      const inner: Scope = { bindings: new Set(), parent: scope };
      if (node.param) collectPatternNames(node.param as EstreeNode, inner.bindings);
      walkForFreeRefs(node.body as EstreeNode, inner, refs);
      return;
    }
    case "TemplateLiteral":
      walk(node.expressions);
      return;
    case "BreakStatement":
    case "ContinueStatement":
      return; // labels are not references
    case "LabeledStatement":
      walk(node.body);
      return;
    // JSX inside an expression: walk attribute values + children, never the
    // element name — component resolution happens via the components map.
    case "JSXElement":
      walk(node.openingElement);
      walk(node.children);
      return;
    case "JSXOpeningElement":
      walk(node.attributes);
      return;
    case "JSXAttribute":
      walk(node.value);
      return;
    case "JSXSpreadAttribute":
      walk(node.argument);
      return;
    case "JSXExpressionContainer":
      walk(node.expression);
      return;
    case "JSXFragment":
      walk(node.children);
      return;
    case "JSXIdentifier":
    case "JSXMemberExpression":
    case "JSXNamespacedName":
    case "JSXText":
    case "JSXEmptyExpression":
      return;
    default: {
      // Generic recursion over child nodes/arrays.
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "range" || key === "start" || key === "end") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const c of value) {
            if (c && typeof c === "object" && typeof (c as EstreeNode).type === "string") {
              walkForFreeRefs(c as EstreeNode, scope, refs);
            }
          }
        } else if (
          value &&
          typeof value === "object" &&
          typeof (value as EstreeNode).type === "string"
        ) {
          walkForFreeRefs(value as EstreeNode, scope, refs);
        }
      }
      return;
    }
  }
}

/** Names bound at file level by an `mdxjsEsm` (import/export) block. */
function collectEsmBindings(program: EstreeNode, into: Set<string>): void {
  for (const stmt of (program.body as EstreeNode[]) ?? []) {
    switch (stmt.type) {
      case "ImportDeclaration":
        for (const spec of (stmt.specifiers as EstreeNode[]) ?? []) {
          collectPatternNames(spec.local as EstreeNode, into);
        }
        break;
      case "ExportNamedDeclaration": {
        const decl = stmt.declaration as EstreeNode | null;
        if (decl?.type === "VariableDeclaration") {
          for (const d of (decl.declarations as EstreeNode[]) ?? []) {
            collectPatternNames(d.id as EstreeNode, into);
          }
        } else if (decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") {
          if (decl.id) collectPatternNames(decl.id as EstreeNode, into);
        }
        break;
      }
      default:
        break;
    }
  }
}

type MdastNode = {
  type: string;
  children?: MdastNode[];
  attributes?: MdastNode[];
  value?: unknown;
  data?: { estree?: EstreeNode };
  position?: { start?: { line: number; column: number } };
};

// Parser parity with the runtime's astro.config: remark-gfm and remark-math
// register micromark *syntax* extensions, so e.g. `$$…$$` math (the target
// of the `<latex>` source rewrite) parses as math instead of literal braces
// hitting the JSX-expression parser.
const processor = createProcessor({ remarkPlugins: [remarkGfm, remarkMath] });

const PLACEHOLDER_HINT =
  "MDX treats {…} as a JSX expression — wrap literal placeholders in backticks";

/**
 * Validate one MDX source. Returns issues; empty array means the file will
 * survive the build's MDX compile + prerender expression evaluation.
 */
/**
 * Blank out YAML frontmatter, preserving line count so every reported
 * position matches the on-disk file. Astro strips frontmatter before the
 * MDX compiler ever sees the source, so check must not parse it as MDX
 * (a `title: Use {placeholders}` frontmatter line is NOT an expression).
 */
function blankFrontmatter(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(source);
  if (!match) return source;
  const block = match[0];
  const newlines = block.match(/\r?\n/g)?.length ?? 0;
  return "\n".repeat(newlines) + source.slice(block.length);
}

export function checkMdxSource(source: string, file: string): MdxIssue[] {
  const issues: MdxIssue[] = [];
  const compat = applyMdxSourceCompat(blankFrontmatter(source)).code;

  let tree: MdastNode;
  try {
    tree = processor.parse(compat) as unknown as MdastNode;
  } catch (err) {
    const e = err as {
      reason?: string;
      message?: string;
      line?: number;
      column?: number;
      place?: { line?: number; column?: number } | { start?: { line?: number; column?: number } };
    };
    let line = e.line;
    let column = e.column;
    if (e.place) {
      const p = e.place as {
        line?: number;
        column?: number;
        start?: { line?: number; column?: number };
      };
      line ??= p.line ?? p.start?.line;
      column ??= p.column ?? p.start?.column;
    }
    const message = e.reason ?? e.message ?? String(err);
    if (line === undefined) {
      // Some MDX errors (e.g. a tag left open at EOF) carry their position
      // only inside the message text: "… for `<Note>` (12:1-12:7)".
      const m = /\((\d+):(\d+)[-)]/.exec(message);
      if (m) {
        line = Number(m[1]);
        column = Number(m[2]);
      }
    }
    issues.push({ file, line, column, message });
    return issues;
  }

  // Pass 1: file-level bindings from import/export blocks.
  const fileBindings = new Set<string>(MDX_PROVIDED);
  for (const g of JS_GLOBALS) fileBindings.add(g);
  visit(tree, (node) => {
    if (node.type === "mdxjsEsm" && node.data?.estree) {
      collectEsmBindings(node.data.estree, fileBindings);
    }
  });
  const fileScope: Scope = { bindings: fileBindings, parent: null };

  // Pass 2: free identifiers in every expression.
  const seen = new Set<string>();
  visit(tree, (node) => {
    const isExpression =
      node.type === "mdxFlowExpression" ||
      node.type === "mdxTextExpression" ||
      node.type === "mdxJsxAttributeValueExpression" ||
      node.type === "mdxJsxExpressionAttribute";
    if (!isExpression || !node.data?.estree) return;

    const refs: FreeRef[] = [];
    walkForFreeRefs(node.data.estree, fileScope, refs);
    for (const ref of refs) {
      const key = `${ref.name}:${ref.line ?? node.position?.start?.line ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        file,
        line: ref.line ?? node.position?.start?.line,
        column: ref.column ?? node.position?.start?.column,
        message: `ReferenceError at build: \`${ref.name}\` is not defined`,
        hint: PLACEHOLDER_HINT,
      });
    }
  });

  return issues;
}

/** Depth-first visit over mdast incl. JSX attribute expression values. */
function visit(node: MdastNode, fn: (node: MdastNode) => void): void {
  fn(node);
  for (const attr of node.attributes ?? []) {
    fn(attr);
    const value = attr.value as MdastNode | string | null | undefined;
    if (value && typeof value === "object") fn(value);
  }
  for (const child of node.children ?? []) {
    visit(child, fn);
  }
}

/** Run MDX checks across every page in the manifest. `.md` pages are plain
 *  Markdown (no JSX expressions) and are skipped. */
export function checkManifestMdx(manifest: Manifest): MdxIssue[] {
  const issues: MdxIssue[] = [];
  for (const [, page] of manifest.pages) {
    if (!page.file.endsWith(".mdx")) continue;
    let source: string;
    try {
      source = readFileSync(page.file, "utf8");
    } catch {
      continue; // missing files are reported by the manifest pass
    }
    const rel = relative(manifest.root, page.file).replaceAll("\\", "/");
    issues.push(...checkMdxSource(source, rel));
  }
  return issues;
}

export function formatMdxIssue(issue: MdxIssue): string {
  const pos = issue.line ? `:${issue.line}${issue.column ? `:${issue.column}` : ""}` : "";
  const hint = issue.hint ? `\n      hint: ${issue.hint}` : "";
  return `${issue.file}${pos} — ${issue.message}${hint}`;
}
