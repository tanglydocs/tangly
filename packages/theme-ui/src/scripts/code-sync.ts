// Cross-page CodeGroup sync. Each named CodeGroup persists its active tab
// label in localStorage under `tangly:codegroup:<name>`. Other groups with
// the same name (on this page or after navigation) restore the saved label
// if present.

interface CodeGroupRegistry {
  register: (
    groupId: string,
    name: string,
    labels: string[],
    activate: (idx: number) => void,
  ) => void;
  onActivate: (groupId: string, name: string, label: string) => void;
}

declare global {
  interface Window {
    __tanglyCodeGroup?: CodeGroupRegistry;
  }
}

const STORAGE_PREFIX = "tangly:codegroup:";

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

function applyForName(name: string, label: string, exceptId?: string) {
  for (const [id, info] of registry.entries()) {
    if (info.name !== name) continue;
    if (id === exceptId) continue;
    const idx = info.labels.indexOf(label);
    if (idx >= 0) info.activate(idx);
  }
}

const api: CodeGroupRegistry = {
  register(groupId, name, labels, activate) {
    registry.set(groupId, { name, labels, activate });
    const saved = read(name);
    if (saved) {
      const idx = labels.indexOf(saved);
      if (idx >= 0) activate(idx);
    }
  },
  onActivate(groupId, name, label) {
    if (!name) return;
    write(name, label);
    applyForName(name, label, groupId);
  },
};

window.__tanglyCodeGroup = api;

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith(STORAGE_PREFIX)) return;
  const name = event.key.slice(STORAGE_PREFIX.length);
  if (!event.newValue) return;
  applyForName(name, event.newValue);
});

export {};
