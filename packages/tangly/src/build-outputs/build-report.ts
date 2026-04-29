import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface RouteSize {
  /** URL path (e.g. "/guides/foo"). */
  route: string;
  /** Bytes. */
  html: number;
  /** Bytes summed across all `<script>` files this page references. */
  js: number;
  /** Bytes summed across all `<link rel="stylesheet">` files. */
  css: number;
  /** Total of html + js + css. */
  total: number;
}

export interface AssetSize {
  path: string;
  size: number;
}

export interface BuildReport {
  routes: RouteSize[];
  largestPages: RouteSize[];
  largestJs: AssetSize[];
  totals: {
    pages: number;
    htmlBytes: number;
    jsBytes: number;
    cssBytes: number;
    assetBytes: number;
  };
  warnings: string[];
}

const HTML_WARN_BYTES = 500 * 1024; // 500 KB
const JS_WARN_BYTES = 100 * 1024; // 100 KB

/**
 * Walk a built `dist/` directory, sum sizes per route, and produce a
 * report. Conservative — only reads filesystem; no parsing of HTML.
 */
export function buildBuildReport(distDir: string): BuildReport {
  const allFiles = walkAllFiles(distDir);
  const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
  const jsFiles = allFiles.filter((f) => f.endsWith(".js"));
  const cssFiles = allFiles.filter((f) => f.endsWith(".css"));

  const routes: RouteSize[] = [];
  for (const f of htmlFiles) {
    const rel = relative(distDir, f).replace(/\\/g, "/");
    const route = "/" + rel.replace(/(?:^|\/)index\.html$/, "").replace(/\.html$/, "");
    const html = sizeOf(f);
    routes.push({ route, html, js: 0, css: 0, total: html });
  }

  // Per-page JS/CSS sizes are only loosely attributable in static builds —
  // we sum the total JS/CSS asset bundles (typically small in Astro static
  // mode) and report them as the "shared" cost in totals.
  const jsAssets: AssetSize[] = jsFiles.map((f) => ({
    path: relative(distDir, f),
    size: sizeOf(f),
  }));
  const cssAssets: AssetSize[] = cssFiles.map((f) => ({
    path: relative(distDir, f),
    size: sizeOf(f),
  }));

  const sumHtml = sum(routes.map((r) => r.html));
  const sumJs = sum(jsAssets.map((a) => a.size));
  const sumCss = sum(cssAssets.map((a) => a.size));
  const sumAssets = sum(allFiles.map(sizeOf));

  const largestPages = [...routes].sort((a, b) => b.total - a.total).slice(0, 10);
  const largestJs = jsAssets.sort((a, b) => b.size - a.size).slice(0, 10);

  const warnings: string[] = [];
  for (const p of routes) {
    if (p.html > HTML_WARN_BYTES) {
      warnings.push(`${p.route}: HTML ${(p.html / 1024).toFixed(1)} KB exceeds 500 KB`);
    }
  }
  for (const j of jsAssets) {
    if (j.size > JS_WARN_BYTES) {
      warnings.push(`${j.path}: JS ${(j.size / 1024).toFixed(1)} KB exceeds 100 KB`);
    }
  }

  return {
    routes,
    largestPages,
    largestJs,
    totals: {
      pages: routes.length,
      htmlBytes: sumHtml,
      jsBytes: sumJs,
      cssBytes: sumCss,
      assetBytes: sumAssets,
    },
    warnings,
  };
}

export function writeBuildReport(
  distDir: string,
  report: BuildReport,
): {
  json: string;
  html: string;
} {
  const reportDir = join(distDir, "_tangly");
  mkdirSync(reportDir, { recursive: true });

  const jsonPath = join(reportDir, "build-report.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const htmlPath = join(reportDir, "build-report.html");
  writeFileSync(htmlPath, renderHtml(report), "utf8");

  return { json: jsonPath, html: htmlPath };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function sizeOf(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

function walkAllFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "_tangly") continue;
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkAllFiles(full, out);
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function renderHtml(report: BuildReport): string {
  const t = report.totals;
  const rows = (rs: RouteSize[]) =>
    rs
      .map(
        (r) => `<tr><td><code>${escapeHtml(r.route)}</code></td><td>${fmtBytes(r.html)}</td></tr>`,
      )
      .join("");
  const jsRows = (rs: AssetSize[]) =>
    rs
      .map(
        (r) => `<tr><td><code>${escapeHtml(r.path)}</code></td><td>${fmtBytes(r.size)}</td></tr>`,
      )
      .join("");
  const warningsHtml = report.warnings.length
    ? `<h2>Warnings</h2><ul>${report.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>Tangly build report</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 64rem; margin: 2rem auto; padding: 0 1.25rem; color: #18181b; }
  h1 { margin-bottom: 0.25rem; }
  .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
  .stat { background: #f4f4f5; padding: 0.75rem 1rem; border-radius: 0.5rem; }
  .stat .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
  .stat .val { font-size: 1.25rem; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  td, th { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e4e4e7; font-size: 0.9rem; }
  th { font-weight: 600; color: #52525b; }
  code { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  ul { padding-left: 1.25rem; }
</style></head><body>
<h1>Tangly build report</h1>
<p>Static build summary, including the 10 largest pages and JS chunks.</p>
<div class="totals">
  <div class="stat"><div class="label">Pages</div><div class="val">${t.pages}</div></div>
  <div class="stat"><div class="label">HTML</div><div class="val">${fmtBytes(t.htmlBytes)}</div></div>
  <div class="stat"><div class="label">JS</div><div class="val">${fmtBytes(t.jsBytes)}</div></div>
  <div class="stat"><div class="label">CSS</div><div class="val">${fmtBytes(t.cssBytes)}</div></div>
</div>
<h2>10 largest pages</h2>
<table><thead><tr><th>Route</th><th>HTML</th></tr></thead><tbody>${rows(report.largestPages)}</tbody></table>
<h2>10 largest JS chunks</h2>
<table><thead><tr><th>Path</th><th>Size</th></tr></thead><tbody>${jsRows(report.largestJs)}</tbody></table>
${warningsHtml}
</body></html>`;
}
