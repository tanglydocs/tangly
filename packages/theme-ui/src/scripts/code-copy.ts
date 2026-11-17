// Click handler for [data-tangly-copy] buttons inside code-figures.
// Strips Shiki/Tangly notation markers from copied text.

const STRIP_PATTERNS: RegExp[] = [
  /\s*\/\/\s*\[!code\s+(?:highlight|focus|--|\+\+|warning|error)(?::[\d-]+)?\]\s*$/gm,
  /\s*#\s*\[!code\s+(?:highlight|focus|--|\+\+|warning|error)(?::[\d-]+)?\]\s*$/gm,
  /\s*\/\*\s*\[!code\s+(?:highlight|focus|--|\+\+|warning|error)(?::[\d-]+)?\]\s*\*\/\s*$/gm,
];

// Terminal output: drop any ESC control sequence that survived rendering
// (shiki's ansi grammar colours SGR but prints other sequences literally).
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

export function stripMarkers(text: string): string {
  let out = stripAnsi(text);
  for (const re of STRIP_PATTERNS) {
    out = out.replace(re, "");
  }
  return out;
}

function findCode(button: HTMLButtonElement): string {
  const figure = button.closest(".tangly-code-figure");
  if (!figure) return "";
  const pre = figure.querySelector("pre");
  if (!pre) return "";
  // Clone and strip annotation pills so copied text is clean code.
  const clone = pre.cloneNode(true) as HTMLPreElement;
  for (const m of clone.querySelectorAll(".tangly-annotation-marker")) {
    m.remove();
  }
  return clone.innerText;
}

function flash(button: HTMLButtonElement) {
  const idle = button.querySelector<HTMLElement>(".tangly-code-copy-idle");
  const done = button.querySelector<HTMLElement>(".tangly-code-copy-done");
  if (!idle || !done) return;
  idle.hidden = true;
  done.hidden = false;
  setTimeout(() => {
    idle.hidden = false;
    done.hidden = true;
  }, 1400);
}

function init() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-tangly-copy]");
    if (!button) return;
    const text = stripMarkers(findCode(button));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      flash(button);
    } catch {
      // Fallback: select the text in the pre.
      const figure = button.closest(".tangly-code-figure");
      const pre = figure?.querySelector("pre");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  });
}

// Guarded so the pure helpers above can be imported under test (no DOM).
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
