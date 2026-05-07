/**
 * Tiny inline SVG icons for the panel language tabs. Returned as raw
 * SVG strings so the consumer can drop them via `set:html`.
 *
 * Each icon is monochrome (`currentColor`), 14×14, with a 1.5 stroke
 * weight to match Lucide's house style.
 */

const T = (path: string, opts: { stroke?: boolean } = {}): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${opts.stroke === false ? "currentColor" : "none"}" ${opts.stroke === false ? "" : 'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${path}</svg>`;

const ICONS: Record<string, string> = {
  curl: T('<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>'),
  bash: T('<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>'),
  shell: T('<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>'),
  // TS / JS — square monogram
  typescript: T(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16.5" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, SFMono-Regular, monospace" fill="currentColor" stroke="none">TS</text>',
  ),
  ts: T(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16.5" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, SFMono-Regular, monospace" fill="currentColor" stroke="none">TS</text>',
  ),
  javascript: T(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16.5" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, SFMono-Regular, monospace" fill="currentColor" stroke="none">JS</text>',
  ),
  js: T(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16.5" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, SFMono-Regular, monospace" fill="currentColor" stroke="none">JS</text>',
  ),
  // Python — stylised lambda
  python: T(
    '<path d="M9 2c-2 0-3 1-3 3v3h6V7H8"/><path d="M15 22c2 0 3-1 3-3v-3h-6v1h4"/><rect x="6" y="8" width="12" height="8" rx="2"/>',
  ),
  py: T(
    '<path d="M9 2c-2 0-3 1-3 3v3h6V7H8"/><path d="M15 22c2 0 3-1 3-3v-3h-6v1h4"/><rect x="6" y="8" width="12" height="8" rx="2"/>',
  ),
  // Go — gopher-ish circle with two dots
  go: T(
    '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.4" fill="currentColor"/><circle cx="15" cy="10" r="1.4" fill="currentColor"/><path d="M8 16h8"/>',
  ),
  ruby: T('<path d="M12 2 22 9 18 22H6L2 9z"/>'),
  rb: T('<path d="M12 2 22 9 18 22H6L2 9z"/>'),
};

export function languageIcon(lang: string): string {
  return ICONS[lang.toLowerCase()] ?? ICONS.curl!;
}

/**
 * Map a free-form lang token (e.g. "ts", "py") to the canonical Shiki
 * language id used by the highlighter. Defaults to the input.
 */
export function shikiLang(lang: string): string {
  switch (lang.toLowerCase()) {
    case "curl":
    case "shell":
    case "sh":
      return "bash";
    case "ts":
      return "typescript";
    case "js":
      return "javascript";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    default:
      return lang.toLowerCase();
  }
}
