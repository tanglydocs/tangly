import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pagePathForSlug } from "@tanglydocs/schema";
import type { Manifest, PageEntry } from "../manifest/index.js";
import { collectPageRoutes, rewriteBodyLinks } from "./rewrite-body-links.js";

export interface PageMarkdownOptions {
  manifest: Manifest;
  outDir: string;
  /** Subpath the site is deployed under (e.g. "/docs"). Defaults to "/". */
  base?: string;
}

function normalizeBase(base?: string): string {
  if (!base || base === "/") return "";
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Render the agent-facing markdown for a page: raw on-disk source +
 * a `URL:` preamble (mirrors `generateLlmsFullTxt`). Frontmatter is
 * preserved — agents can use `title`/`description` as context.
 */
function generatePageMarkdown(
  page: PageEntry,
  urlPath: string,
  base: string,
  pageRoutes: Set<string>,
): string {
  let raw: string;
  try {
    raw = readFileSync(page.file, "utf8");
  } catch {
    return "";
  }
  // Frontmatter stays verbatim (not a link target); rewrite only the body.
  const match = raw.match(/^(---[\s\S]*?---\n)([\s\S]*)$/);
  const frontmatter = match ? match[1]! : "";
  const body = match ? match[2]! : raw;
  return `URL: ${urlPath}\n\n${frontmatter}${rewriteBodyLinks(body, base, pageRoutes)}`;
}

/**
 * Emit `<slug>.md` under outDir for every non-draft, non-noindex page.
 * Files sit alongside the rendered HTML so `<page>.md` and `<page>/index.html`
 * coexist on every static host (Vercel, Cloudflare Pages, Netlify, S3, GH Pages).
 */
export function writePageMarkdown(opts: PageMarkdownOptions): { written: number } {
  const base = normalizeBase(opts.base);
  const pageRoutes = collectPageRoutes(opts.manifest);
  let written = 0;
  for (const page of opts.manifest.pages.values()) {
    if (page.draft) continue;
    if (page.frontmatter.noindex) continue;
    const dest = join(opts.outDir, `${page.slug}.md`);
    mkdirSync(dirname(dest), { recursive: true });
    // `dest` stays slug-derived (the file lives at `index.md`); the URL
    // preamble must be the served route, not the file path.
    const urlPath = pagePathForSlug(page.slug, base);
    writeFileSync(dest, generatePageMarkdown(page, urlPath, base, pageRoutes), "utf8");
    written += 1;
  }
  return { written };
}
