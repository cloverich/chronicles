import { Root } from "mdast";

import { parseMarkdown as parseMarkdownRaw } from "./index.js";

// Remove the parsed position information to simplify deep equals comparisons
// There is a similar function that's an entire npm package; fuck that.
export function prunePositions(tree: any) {
  if (tree.position) {
    delete tree.position;
  }
  if (tree.children) {
    tree.children.forEach(prunePositions);
  }
  return tree;
}

// Easier to deep.equal() without position information
export const parseMarkdown = (markdown: string): Root =>
  prunePositions(parseMarkdownRaw(markdown));

// Like _.get but fail loud, helpful error messages
// Usage: dig(mdast, 'children.0.children.1.value')
export function dig(obj: any, path: string) {
  const keys = path
    .split(".")
    .map((key) => (isNaN(Number(key)) ? key : Number(key)));

  return keys.reduce((acc, key, index) => {
    if (acc && key in acc) {
      return acc[key];
    } else {
      throw new Error(
        `Path error at step "${key}" (index ${index})\n` +
          `Full path: ${path}\n` +
          `Last good step object: ${JSON.stringify(acc, null, 2)}`,
      );
    }
  }, obj);
}
