/**
 * remark plugin: warn (in dev) when MDX content contains an h1.
 *
 * Frontmatter `title` already renders as the page <h1> (PageShell.astro).
 * An additional `# Heading` or `<h1>` in the body produces a duplicate H1,
 * which hurts a11y + SEO and breaks the right-rail TOC's level expectations.
 *
 * No-op outside dev (TANGLY_MODE !== "dev") and on synthetic files with no
 * resolvable path.
 */
import pc from "picocolors";
import { relative } from "node:path";
import { visit } from "unist-util-visit";

export default function remarkH1Warn() {
  return (tree, file) => {
    if (process.env.TANGLY_MODE !== "dev") return;

    const lines = [];

    visit(tree, (node) => {
      if (node.type === "heading" && node.depth === 1) {
        lines.push(node.position?.start?.line);
      } else if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        node.name === "h1"
      ) {
        lines.push(node.position?.start?.line);
      }
    });

    if (lines.length === 0) return;

    const userRoot = process.env.TANGLY_USER_ROOT;
    const path = file?.path ?? file?.history?.[0];
    const rel = path && userRoot ? relative(userRoot, path) : (path ?? "<unknown>");
    const where = lines.filter(Boolean).join(", ");

    console.warn(
      pc.yellow(
        `[tangly] H1 in content: ${rel}${where ? `:${where}` : ""} — frontmatter "title" already renders as <h1>. Use ## for top-level sections.`,
      ),
    );
  };
}
