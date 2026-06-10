import { basename, relative } from "node:path";
import { checkManifestMdx, formatMdxIssue } from "./mdx-check.js";
import type { Manifest } from "../manifest/types.js";

/**
 * Translate an Astro build/prerender failure into lines that point at the
 * author's source file instead of a `.prerender/chunks/*.mjs` stack.
 *
 * Strategy, most precise first:
 *   1. Re-run the check-time MDX scan — if it finds issues (unbound
 *      expression identifiers, syntax errors), those ARE the build failure,
 *      with exact file:line:col.
 *   2. Map the prerender chunk filename (`website-search_C0d3.mjs`) back to
 *      the page(s) whose source basename matches.
 *   3. Fall back to the error's first line.
 */
export function describeBuildError(err: unknown, manifest: Manifest): string[] {
  const e = err as { name?: string; message?: string; stack?: string };
  const message = (e.message ?? String(err)).split("\n")[0] ?? "Unknown error";
  const name = e.name && e.name !== "Error" ? e.name : undefined;
  const isReferenceError = /ReferenceError/.test(`${e.name} ${e.message} ${e.stack ?? ""}`);

  const lines: string[] = [];

  // Only page-content failures warrant the MDX rescan — an fs error during
  // the copy phase (ENOSPC, staging raced away) must surface as itself, not
  // as a misleading "here's your bad page" diagnosis.
  const blob = `${e.name ?? ""} ${e.message ?? ""} ${e.stack ?? ""}`;
  const looksLikeContentError = /\.mdx?\b|prerender|render|ReferenceError|[/\\]chunks[/\\]/i.test(
    blob,
  );

  // 1. Precise: the MDX scan reproduces expression/syntax failures at source.
  if (looksLikeContentError) {
    try {
      const issues = checkManifestMdx(manifest);
      if (issues.length > 0) {
        for (const issue of issues) lines.push(`✗ ${formatMdxIssue(issue)}`);
        lines.push(`  (\`tangly check\` catches these before a build)`);
        return lines;
      }
    } catch {
      // The scan must never mask the real error.
    }
  }

  // 2. Chunk filename → source page(s). Astro names prerender chunks after
  //    the module that failed: chunks/<basename>_<hash>.mjs. The basename
  //    itself may contain underscores (api_reference.mdx), so try every
  //    underscore split, longest prefix first.
  const chunkName = /[/\\]chunks[/\\]([^/\\]+)\.mjs/.exec(e.stack ?? "")?.[1];
  if (chunkName) {
    const candidates: string[] = [];
    let prefix = chunkName;
    while (candidates.length === 0 && prefix.includes("_")) {
      prefix = prefix.replace(/_[^_]*$/, "");
      for (const [, page] of manifest.pages) {
        const base = basename(page.file).replace(/\.(mdx?|md)$/, "");
        if (base === prefix) {
          candidates.push(relative(manifest.root, page.file).replaceAll("\\", "/"));
        }
      }
    }
    if (candidates.length > 0 && candidates.length <= 3) {
      for (const c of candidates) {
        lines.push(`✗ ${c} — ${name ? `${name}: ` : ""}${message}`);
      }
      if (isReferenceError) {
        lines.push(
          "  hint: `{…}` in MDX is a JSX expression — wrap literal placeholders in backticks",
        );
      }
      return lines;
    }
  }

  // 3. Generic.
  lines.push(`✗ Build failed — ${name ? `${name}: ` : ""}${message}`);
  if (isReferenceError) {
    lines.push("  hint: `{…}` in MDX is a JSX expression — wrap literal placeholders in backticks");
  }
  return lines;
}
