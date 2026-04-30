import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import type { Manifest, PageEntry } from "../manifest/index.js";

export interface BuildOutputsOptions {
  manifest: Manifest;
  outDir: string;
  /** Public site URL (used for absolute URLs in sitemap). */
  siteUrl?: string;
}

export function generateSitemap(opts: BuildOutputsOptions): string {
  const base = (opts.siteUrl ?? "").replace(/\/+$/, "");
  const urls: string[] = [];
  for (const page of opts.manifest.pages.values()) {
    if (page.draft) continue;
    if (page.frontmatter.noindex) continue;
    const loc = base ? `${base}/${page.slug}` : `/${page.slug}`;
    urls.push(`  <url><loc>${escapeXml(loc)}</loc></url>`);
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

export function generateRobots(opts: BuildOutputsOptions): string {
  const base = (opts.siteUrl ?? "").replace(/\/+$/, "");
  const sitemap = base ? `${base}/sitemap.xml` : "/sitemap.xml";
  return [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${sitemap}`, ""].join("\n");
}

export function generateLlmsTxt(opts: BuildOutputsOptions): string {
  const lines: string[] = [];
  const cfg = opts.manifest.config;
  lines.push(`# ${cfg.name}`);
  if (cfg.description) lines.push(`> ${cfg.description}`);
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  for (const page of opts.manifest.pages.values()) {
    if (page.draft) continue;
    if (page.frontmatter.noindex) continue;
    const title = page.frontmatter.title ?? page.slug;
    const desc = page.frontmatter.description ? `: ${page.frontmatter.description}` : "";
    lines.push(`- [${title}](/${page.slug})${desc}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function generateLlmsFullTxt(opts: BuildOutputsOptions): string {
  const lines: string[] = [];
  const cfg = opts.manifest.config;
  lines.push(`# ${cfg.name}\n`);
  if (cfg.description) lines.push(`${cfg.description}\n`);

  for (const page of opts.manifest.pages.values()) {
    if (page.draft) continue;
    if (page.frontmatter.noindex) continue;
    const title = page.frontmatter.title ?? page.slug;
    lines.push(`\n---\n\n# ${title}\n`);
    if (page.frontmatter.description) lines.push(`${page.frontmatter.description}\n`);
    lines.push(`\nURL: /${page.slug}\n\n`);
    try {
      const raw = readFileSync(page.file, "utf8");
      const body = raw.replace(/^---[\s\S]*?---\n/, "");
      lines.push(body);
    } catch {
      // skip unreadable
    }
  }
  return lines.join("\n");
}

export function writeBuildOutputs(opts: BuildOutputsOptions): {
  sitemap: string;
  robots: string;
  llms: string;
  llmsFull: string;
} {
  const sitemap = generateSitemap(opts);
  const robots = generateRobots(opts);
  const llms = generateLlmsTxt(opts);
  const llmsFull = generateLlmsFullTxt(opts);

  // copy-assets runs before this — if the user dropped their own version of
  // any of these at the project root, it's already in dist. Defer to it.
  writeIfAbsent(opts.outDir, "sitemap.xml", sitemap);
  writeIfAbsent(opts.outDir, "robots.txt", robots);
  writeIfAbsent(opts.outDir, "llms.txt", llms);
  writeIfAbsent(opts.outDir, "llms-full.txt", llmsFull);

  return { sitemap, robots, llms, llmsFull };
}

function writeIfAbsent(outDir: string, name: string, content: string): void {
  const dest = join(outDir, name);
  if (existsSync(dest)) {
    console.log(pc.dim(`  ↳ ${name}: using project file (skipped generated)`));
    return;
  }
  writeFileSync(dest, content, "utf8");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// `unused-vars` suppressor to keep PageEntry import non-tree-shaken in d.ts.
export type { PageEntry };
