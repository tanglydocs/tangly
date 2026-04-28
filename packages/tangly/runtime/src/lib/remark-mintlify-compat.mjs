/**
 * remark plugin: pre-process Mintlify quirks before MDX's JSX parser
 * sees the source.
 *
 * - <latex>...</latex>  →  block math fence ($$...$$)
 * - <Latex>...</Latex>  →  same
 *
 * Without this, LaTeX expressions like `\sum_{j=1}^M` get parsed by MDX as
 * `{j=1}` JSX expressions and either crash on unknown identifiers or get
 * rendered as plain JS.
 */
export default function remarkMintlifyCompat() {
  return (_tree, file) => {
    if (typeof file.value !== "string") return;
    file.value = file.value.replace(/<latex>([\s\S]*?)<\/latex>/gi, (_match, body) => {
      const trimmed = body.trim();
      return `\n\n$$\n${trimmed}\n$$\n\n`;
    });
  };
}
