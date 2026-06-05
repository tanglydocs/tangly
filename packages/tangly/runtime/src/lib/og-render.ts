/**
 * OG card renderer: satori (layout -> SVG, text baked to vector paths) +
 * @resvg/resvg-wasm (SVG -> PNG). All-WASM so it runs anywhere the tangly CLI
 * is installed (npx/bunx on any OS/arch) with no native binary matrix.
 *
 * Font buffers and the wasm module are loaded once per process (module-level
 * singletons) — the dominant avoidable cost when emitting hundreds of cards.
 * On any failure the renderer returns `null`: the build/site never breaks, and
 * the layout falls back to the logo as og:image.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import satori, { type FontWeight } from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import type { DocsJson } from "@tanglydocs/schema";
import { buildCard, resolveCardStyle, type CardContent } from "./og-styles.ts";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const require_ = createRequire(import.meta.url);

// Fonts live at <runtime>/src/og/fonts. Prefer the runtime dir injected by
// astro.config via Vite `define` (correct even after the endpoint is bundled
// into a build chunk where import.meta.url no longer points at source); fall
// back to a path relative to this module for the dev server.
declare const __TANGLY_RUNTIME_DIR__: string | undefined;
const FONT_DIR =
  typeof __TANGLY_RUNTIME_DIR__ === "string"
    ? resolve(__TANGLY_RUNTIME_DIR__, "src/og/fonts")
    : fileURLToPath(new URL("../og/fonts", import.meta.url));

interface LoadedFont {
  name: string;
  data: Buffer;
  weight: FontWeight;
  style: "normal";
}

let fontsCache: LoadedFont[] | null = null;
function loadFonts(): LoadedFont[] {
  if (fontsCache) return fontsCache;
  const f = (file: string) => readFileSync(resolve(FONT_DIR, file));
  fontsCache = [
    { name: "Inter", data: f("Inter-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Inter", data: f("Inter-SemiBold.ttf"), weight: 600, style: "normal" },
    { name: "Inter", data: f("Inter-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Spectral", data: f("Spectral-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Crimson Pro", data: f("CrimsonPro-Bold.ttf"), weight: 700, style: "normal" },
  ];
  return fontsCache;
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    // resvg-wasm exposes the wasm as an explicit package export.
    const wasmPath = require_.resolve("@resvg/resvg-wasm/index_bg.wasm");
    wasmReady = initWasm(readFileSync(wasmPath)).catch((err: Error) => {
      // initWasm throws if called twice (e.g. dev HMR re-imports the module).
      // Treat an already-initialized module as ready; re-throw anything else.
      if (/already/i.test(err.message)) return;
      wasmReady = null;
      throw err;
    });
  }
  return wasmReady;
}

/**
 * Render a 1200x630 PNG for one page. Returns `null` (never throws) on any
 * engine failure so callers can fall back cleanly.
 */
export async function renderOgPng(content: CardContent, config: DocsJson): Promise<Buffer | null> {
  try {
    await ensureWasm();
    const style = resolveCardStyle(config);
    const tree = buildCard(style, content);
    const svg = await satori(tree as Parameters<typeof satori>[0], {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: loadFonts(),
    });
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: OG_WIDTH } });
    return Buffer.from(resvg.render().asPng());
  } catch (err) {
    console.warn(`[tangly] OG card render failed: ${(err as Error).message}`);
    return null;
  }
}
