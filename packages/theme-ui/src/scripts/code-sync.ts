// Cross-page sync for tab-like components (CodeGroup + Tabs).
//
// Two ways a group joins the sync pool:
//
//   1. Author passes an explicit `name` — every group with that name picks
//      up the same active label.
//
//   2. Author leaves `name` empty. The runtime sniffs the labels against a
//      known-family registry (npm/yarn/pnpm/bun, pip/uv, macOS/Linux/Windows,
//      python/typescript, ...) and assigns a derived sync name like
//      `auto:pkg-js`. Authors don't have to remember the convention — if
//      the labels are a recognized set, it just works.
//
// Active label is persisted under `tangly:codegroup:<name>`.

interface CodeGroupRegistry {
  register: (
    groupId: string,
    name: string,
    labels: string[],
    activate: (idx: number) => void,
  ) => void;
  onActivate: (groupId: string, name: string, label: string) => void;
  /** Returns a derived sync name if labels match a known family, else "". */
  deriveName: (labels: string[]) => string;
}

declare global {
  interface Window {
    __tanglyCodeGroup?: CodeGroupRegistry;
  }
}

const STORAGE_PREFIX = "tangly:codegroup:";

// Known label families. Earlier entries win on ties.
// All members are lowercased (matching is case-insensitive).
const FAMILIES: Array<{ name: string; members: Set<string> }> = [
  {
    name: "auto:pkg-js",
    members: new Set(["npm", "yarn", "pnpm", "bun"]),
  },
  {
    name: "auto:pkg-py",
    members: new Set(["pip", "uv", "poetry", "pdm", "conda", "hatch", "rye"]),
  },
  {
    name: "auto:pkg-rust",
    members: new Set(["cargo"]),
  },
  {
    name: "auto:os",
    members: new Set([
      "macos",
      "mac",
      "osx",
      "linux",
      "windows",
      "win",
      "wsl",
      "ubuntu",
      "debian",
      "fedora",
      "arch",
    ]),
  },
  {
    name: "auto:shell",
    members: new Set(["bash", "zsh", "fish", "sh", "powershell", "pwsh", "cmd"]),
  },
  {
    name: "auto:runtime-js",
    members: new Set(["node", "deno", "bun"]),
  },
  {
    name: "auto:lang",
    members: new Set([
      "typescript",
      "javascript",
      "ts",
      "js",
      "python",
      "py",
      "go",
      "golang",
      "rust",
      "rs",
      "ruby",
      "rb",
      "java",
      "php",
      "swift",
      "kotlin",
      "kt",
      "c",
      "cpp",
      "c++",
      "csharp",
      "c#",
      "elixir",
      "ex",
      "haskell",
      "hs",
      "lua",
      "r",
      "scala",
      "dart",
      "ocaml",
      "ml",
      "zig",
      "nim",
      "perl",
      "pl",
    ]),
  },
  {
    name: "auto:editor",
    members: new Set([
      "vscode",
      "cursor",
      "vim",
      "neovim",
      "nvim",
      "emacs",
      "sublime",
      "jetbrains",
      "intellij",
      "webstorm",
      "pycharm",
      "zed",
      "fleet",
      "windsurf",
    ]),
  },
];

function deriveName(labels: string[]): string {
  if (labels.length < 2) return "";
  const lower = labels.map((l) => l.trim().toLowerCase());
  for (const family of FAMILIES) {
    let allMatch = true;
    for (const lbl of lower) {
      if (!family.members.has(lbl)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return family.name;
  }
  return "";
}

function key(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

function read(name: string): string | null {
  try {
    return localStorage.getItem(key(name));
  } catch {
    return null;
  }
}

function write(name: string, label: string) {
  try {
    localStorage.setItem(key(name), label);
  } catch {
    /* swallow */
  }
}

const registry = new Map<
  string,
  { name: string; labels: string[]; activate: (idx: number) => void }
>();

// Case-insensitive label lookup so a "bun" tab on one page activates a
// "Bun" tab on another.
function findLabelIndex(labels: string[], target: string): number {
  const t = target.toLowerCase();
  for (let i = 0; i < labels.length; i++) {
    const lbl = labels[i];
    if (lbl !== undefined && lbl.toLowerCase() === t) return i;
  }
  return -1;
}

function applyForName(name: string, label: string, exceptId?: string) {
  for (const [id, info] of registry.entries()) {
    if (info.name !== name) continue;
    if (id === exceptId) continue;
    const idx = findLabelIndex(info.labels, label);
    if (idx >= 0) info.activate(idx);
  }
}

const api: CodeGroupRegistry = {
  register(groupId, name, labels, activate) {
    registry.set(groupId, { name, labels, activate });
    const saved = read(name);
    if (saved) {
      const idx = findLabelIndex(labels, saved);
      if (idx >= 0) activate(idx);
    }
  },
  onActivate(groupId, name, label) {
    if (!name) return;
    write(name, label);
    applyForName(name, label, groupId);
  },
  deriveName,
};

window.__tanglyCodeGroup = api;

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith(STORAGE_PREFIX)) return;
  const name = event.key.slice(STORAGE_PREFIX.length);
  if (!event.newValue) return;
  applyForName(name, event.newValue);
});

export {};
