import type { Options } from "mdast-util-to-markdown";

/**
 * Create an extension for `mdast-util-to-markdown` to enable OFM wikilinks in markdown.
 */
export function ofmWikilinkToMarkdown(): Options {
  return {
    handlers: {
      ofmWikilink(node) {
        const path = node.url;
        const parts = path.split("/");
        const file = parts[parts.length - 1];

        const path_name = file.includes(".")
          ? file.split(".").slice(0, -1).join(".")
          : file;
        const alias = path_name === node.value ? "" : `|${node.value}`;
        const hash = node.hash ? `#${node.hash}` : "";
        return `[[${path}${hash}${alias}]]`;
      },
      ofmWikiembedding(node) {
        const path = node.url;
        const parts = path.split("/");
        const file = parts[parts.length - 1];

        const path_name = file.includes(".")
          ? file.split(".").slice(0, -1).join(".")
          : file;
        const alias = path_name === node.value ? "" : `|${node.value}`;
        const hash = node.hash ? `#${node.hash}` : "";
        return `![[${path}${hash}${alias}]]`;
      },
    },
  };
}
