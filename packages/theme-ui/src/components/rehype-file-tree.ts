/* Rehype processor for <FileTree>.
 * Adapted from Starlight (https://github.com/withastro/starlight) — MIT.
 * Walks the rendered <ul> tree, classifies each <li> as file/directory/placeholder,
 * extracts highlight (<strong>) and trailing comment text, and emits semantic markup
 * with <details>/<summary> directories and inlined SVG icons. */

import type { Element, ElementContent, Text } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toString } from "hast-util-to-string";
import { type Child, h } from "hastscript";
import { rehype } from "rehype";
import { CONTINUE, SKIP, visit } from "unist-util-visit";
import { defaultFileIconSvg, fileIconSvg, folderIconSvg } from "./file-tree-icons";

declare module "vfile" {
  interface DataMap {
    directoryLabel: string;
  }
}

export interface ProcessOptions {
  directoryLabel?: string;
}

export function processFileTree(
  html: string,
  { directoryLabel = "Directory" }: ProcessOptions = {},
): string {
  const file = fileTreeProcessor.processSync({
    data: { directoryLabel },
    value: html,
  });
  return file.toString();
}

const fileTreeProcessor = rehype()
  .data("settings", { fragment: true })
  .use(function fileTree() {
    return (tree: Element, file) => {
      const directoryLabel = file.data.directoryLabel ?? "Directory";

      validateFileTree(tree);

      visit(tree, "element", (node: Element) => {
        // Strip whitespace-only text nodes left over from MDX list rendering.
        node.children = node.children.filter(
          (child: ElementContent) =>
            child.type === "comment" || child.type !== "text" || !/^\n+$/.test(child.value),
        );

        if (node.tagName !== "li") return CONTINUE;

        const [firstChild, ...otherChildren] = node.children;

        const comment: Child[] = [];

        // Split text comment from filename: "README.md start here" → name="README.md", comment="start here".
        if (firstChild?.type === "text") {
          const [filename, ...fragments] = firstChild.value.split(" ");
          firstChild.value = filename || "";
          const textComment = fragments.join(" ").trim();
          if (textComment.length > 0) {
            comment.push(fragments.join(" "));
          }
        }

        // Comments may continue past the first text node — capture every node up to the first nested <ul>.
        const subTreeIndex = otherChildren.findIndex(
          (child: ElementContent) => child.type === "element" && child.tagName === "ul",
        );
        const commentNodes =
          subTreeIndex > -1 ? otherChildren.slice(0, subTreeIndex) : [...otherChildren];
        otherChildren.splice(0, subTreeIndex > -1 ? subTreeIndex : otherChildren.length);
        comment.push(...commentNodes);

        const firstChildText = firstChild ? toString(firstChild) : "";

        const isDirectory =
          /\/\s*$/.test(firstChildText) ||
          otherChildren.some((c: ElementContent) => c.type === "element" && c.tagName === "ul");
        const isPlaceholder = /^\s*(\.{3}|…)\s*$/.test(firstChildText);
        const isHighlighted = firstChild?.type === "element" && firstChild.tagName === "strong";

        // Build the icon span (placeholders get no icon).
        const iconSvg = isDirectory ? folderIconSvg() : fileIconSvg(firstChildText);
        const iconChildren: Child[] = isPlaceholder
          ? []
          : (fromHtml(iconSvg, { fragment: true }).children as Child[]);
        const iconSpanChildren: Child[] = isDirectory
          ? [h("span", { class: "sr-only" }, directoryLabel), ...iconChildren]
          : iconChildren;
        const icon = h("span", { class: "tree-icon-wrap" }, ...iconSpanChildren);

        node.properties.class = isDirectory ? "directory" : "file";
        if (isPlaceholder) node.properties.class = `${node.properties.class} empty`;

        const innerChildren: Child[] = [];
        if (!isPlaceholder) innerChildren.push(icon);
        if (firstChild) innerChildren.push(firstChild as Child);

        const treeEntryChildren: Child[] = [
          h("span", { class: isHighlighted ? "highlight" : "" }, ...innerChildren),
        ];

        if (comment.length > 0) {
          treeEntryChildren.push(makeText(" "), h("span", { class: "comment" }, ...comment));
        }

        const treeEntry = h("span", { class: "tree-entry" }, ...treeEntryChildren);

        if (isDirectory) {
          const hasContents = otherChildren.length > 0;
          const childList: Child[] = hasContents
            ? (otherChildren as Child[])
            : [h("ul", h("li", "…"))];
          node.children = [
            h("details", { open: hasContents }, h("summary", treeEntry), ...childList),
          ];
          return CONTINUE;
        }

        node.children = [treeEntry, ...(otherChildren as ElementContent[])];
        return SKIP;
      });
    };
  });

function makeText(value = ""): Text {
  return { type: "text", value };
}

function validateFileTree(tree: Element): void {
  const rootElements = tree.children.filter(isElement);
  const [root] = rootElements;

  if (rootElements.length === 0) {
    throw new Error(
      "<FileTree> expects its content to be a single unordered list, but found no child elements.",
    );
  }
  if (rootElements.length !== 1) {
    throw new Error(
      `<FileTree> expects a single unordered list, but found multiple children: ${rootElements
        .map((el: Element) => `<${el.tagName}>`)
        .join(", ")}.`,
    );
  }
  if (!root || root.tagName !== "ul") {
    throw new Error(`<FileTree> expects a <ul>, but got <${root?.tagName ?? "unknown"}>.`);
  }
  let hasLi = false;
  visit(root, "element", (n: Element) => {
    if (n.tagName === "li") {
      hasLi = true;
      return false;
    }
    return CONTINUE;
  });
  if (!hasLi) {
    throw new Error("<FileTree> expects an unordered list with at least one item.");
  }
}

function isElement(node: ElementContent): node is Element {
  return node.type === "element";
}

export { defaultFileIconSvg };
