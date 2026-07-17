import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pagePathForSlug } from "@tanglydocs/schema";
import type { Manifest, PageEntry } from "../manifest/index.js";

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
function generatePageMarkdown(page: PageEntry, urlPath: string): string {
  let raw: string;
  try {
    raw = readFileSync(page.file, "utf8");
  } catch {
    return "";
  }
  return `URL: ${urlPath}\n\n${raw}`;
}

/**
 * Emit `<slug>.md` under outDir for every non-draft, non-noindex page.
 * Files sit alongside the rendered HTML so `<page>.md` and `<page>/index.html`
 * coexist on every static host (Vercel, Cloudflare Pages, Netlify, S3, GH Pages).
 */
export function writePageMarkdown(opts: PageMarkdownOptions): { written: number } {
  const base = normalizeBase(opts.base);
  let written = 0;
  for (const page of opts.manifest.pages.values()) {
    if (page.draft) continue;
    if (page.frontmatter.noindex) continue;
    const dest = join(opts.outDir, `${page.slug}.md`);
    mkdirSync(dirname(dest), { recursive: true });
    // `dest` stays slug-derived (the file lives at `index.md`); the URL
    // preamble must be the served route, not the file path.
    const urlPath = pagePathForSlug(page.slug, base);
    writeFileSync(dest, generatePageMarkdown(page, urlPath), "utf8");
    written += 1;
  }
  return { written };
}
