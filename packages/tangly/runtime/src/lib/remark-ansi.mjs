// Remark plugin for ```ansi fences. Runs before shiki, whose `ansi` language
// colours SGR sequences (ESC [ ... m) and nothing else.
//
// Two jobs:
//   1. Accept the textual escapes authors can type in an editor (`\e[`,
//      `\x1b[`, `\u001b[`, `\033[`) and turn them into a real ESC byte.
//   2. Drop control sequences that are not SGR (cursor moves, erase-line,
//      hyperlinks). Shiki would print them as literal junk.

const ESC = "\u001b";

// A textual escape is only converted when a `[` follows, so a stray `\e` or
// `\033` elsewhere in the output is left alone.
const TEXTUAL_ESC = /\\(?:e|x1[bB]|u001[bB]|033)(?=\[)/g;
// CSI: ESC [ params intermediates final. Keep it only when final is `m`.
// eslint-disable-next-line no-control-regex
const CSI = /\u001b\[([0-?]*)([ -/]*)([@-~])/g;
// OSC: ESC ] ... terminated by BEL or ESC \.
// eslint-disable-next-line no-control-regex
const OSC = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

export function normalizeAnsi(text) {
  return text
    .replace(TEXTUAL_ESC, ESC)
    .replace(OSC, "")
    .replace(CSI, (m, _params, _inter, final) => (final === "m" ? m : ""))
    .replace(/\r\n?/g, "\n");
}

function visit(node, fn) {
  if (!node || typeof node !== "object") return;
  fn(node);
  if (Array.isArray(node.children)) for (const c of node.children) visit(c, fn);
}

export default function remarkAnsi() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type === "code" && node.lang === "ansi" && typeof node.value === "string") {
        node.value = normalizeAnsi(node.value);
      }
    });
  };
}
