/* File icon mapping for <FileTree>.
 * Adapted from Starlight (https://github.com/withastro/starlight) — MIT.
 * Iconography mirrors Tangly's existing Icon component (Lucide). */

import * as lucide from "lucide";

type LucideNode = [tag: string, attrs: Record<string, string | number>];

/** Exact filename → Lucide icon name. */
export const filenames: Record<string, string> = {
  "package.json": "Package",
  "package-lock.json": "Lock",
  "bun.lock": "Lock",
  "bun.lockb": "Lock",
  "pnpm-lock.yaml": "Lock",
  "yarn.lock": "Lock",
  "tsconfig.json": "Settings2",
  "tangly.config.ts": "Settings2",
  "astro.config.mjs": "Rocket",
  "astro.config.ts": "Rocket",
  "vite.config.ts": "Bolt",
  "tailwind.config.js": "Wind",
  "tailwind.config.ts": "Wind",
  "postcss.config.js": "FileCode2",
  ".gitignore": "GitBranch",
  ".env": "KeyRound",
  ".env.local": "KeyRound",
  ".env.example": "KeyRound",
  Dockerfile: "Container",
  Makefile: "Wrench",
  LICENSE: "Scale",
  "README.md": "BookOpen",
  "docs.json": "Book",
  "mint.json": "Book",
  "CHANGELOG.md": "History",
  CODEOWNERS: "Users",
};

/** File extension → Lucide icon name. Extensions checked left-to-right (dot included). */
export const extensions: Record<string, string> = {
  ".astro": "Rocket",
  ".mdx": "FileText",
  ".md": "FileText",
  ".markdown": "FileText",
  ".html": "Code",
  ".htm": "Code",
  ".css": "Palette",
  ".scss": "Palette",
  ".sass": "Palette",
  ".less": "Palette",
  ".js": "FileCode2",
  ".cjs": "FileCode2",
  ".mjs": "FileCode2",
  ".jsx": "FileCode2",
  ".ts": "FileCode2",
  ".tsx": "FileCode2",
  ".json": "Braces",
  ".jsonc": "Braces",
  ".json5": "Braces",
  ".yaml": "Braces",
  ".yml": "Braces",
  ".toml": "Braces",
  ".xml": "Code",
  ".py": "FileCode",
  ".rb": "FileCode",
  ".go": "FileCode",
  ".rs": "FileCode",
  ".java": "FileCode",
  ".kt": "FileCode",
  ".swift": "FileCode",
  ".c": "FileCode",
  ".h": "FileCode",
  ".cpp": "FileCode",
  ".hpp": "FileCode",
  ".cs": "FileCode",
  ".php": "FileCode",
  ".sh": "Terminal",
  ".bash": "Terminal",
  ".zsh": "Terminal",
  ".fish": "Terminal",
  ".sql": "Database",
  ".prisma": "Database",
  ".graphql": "Network",
  ".gql": "Network",
  ".png": "Image",
  ".jpg": "Image",
  ".jpeg": "Image",
  ".gif": "Image",
  ".webp": "Image",
  ".avif": "Image",
  ".svg": "Image",
  ".ico": "Image",
  ".mp4": "Video",
  ".mov": "Video",
  ".webm": "Video",
  ".mp3": "Music",
  ".wav": "Music",
  ".pdf": "FileText",
  ".zip": "FileArchive",
  ".tar": "FileArchive",
  ".gz": "FileArchive",
  ".lock": "Lock",
  ".env": "KeyRound",
};

/** Substring contained in filename → Lucide icon name. */
export const partials: Record<string, string> = {
  Dockerfile: "Container",
  Makefile: "Wrench",
};

const FOLDER_ICON_NAME = "Folder";
const FOLDER_OPEN_ICON_NAME = "FolderOpen";
const DEFAULT_FILE_ICON_NAME = "File";

const escapeAttr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderLucideToSvg = (iconName: string): string => {
  const reg = lucide as unknown as Record<string, LucideNode[] | undefined>;
  const nodes = reg[iconName];
  if (!nodes) return renderLucideToSvg(DEFAULT_FILE_ICON_NAME);
  const inner = nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(" ");
      return `<${tag} ${a} />`;
    })
    .join("");
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"',
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"',
    ' stroke-linejoin="round" class="tree-icon" aria-hidden="true">',
    inner,
    "</svg>",
  ].join("");
};

const iconCache = new Map<string, string>();
const cachedIcon = (name: string): string => {
  let svg = iconCache.get(name);
  if (svg) return svg;
  svg = renderLucideToSvg(name);
  iconCache.set(name, svg);
  return svg;
};

export const folderIconSvg = (): string => cachedIcon(FOLDER_ICON_NAME);
export const folderOpenIconSvg = (): string => cachedIcon(FOLDER_OPEN_ICON_NAME);
export const defaultFileIconSvg = (): string => cachedIcon(DEFAULT_FILE_ICON_NAME);

const lookupIconName = (fileName: string): string => {
  const trimmed = fileName.replace(/\/$/, "").trim();
  const exact = filenames[trimmed];
  if (exact) return exact;
  const dot = trimmed.indexOf(".");
  if (dot !== -1) {
    let ext = trimmed.slice(dot);
    while (ext) {
      const hit = extensions[ext];
      if (hit) return hit;
      const next = ext.indexOf(".", 1);
      if (next === -1) break;
      ext = ext.slice(next);
    }
  }
  for (const [needle, name] of Object.entries(partials)) {
    if (trimmed.includes(needle)) return name;
  }
  return DEFAULT_FILE_ICON_NAME;
};

export const fileIconSvg = (fileName: string): string => cachedIcon(lookupIconName(fileName));
