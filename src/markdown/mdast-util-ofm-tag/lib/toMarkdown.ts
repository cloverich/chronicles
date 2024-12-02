import type { Options } from "mdast-util-to-markdown";

/**
 * Create an extension for `mdast-util-to-markdown` to enable OFM tags in markdown.
 */
export function ofmTagToMarkdown(): Options {
  return {
    handlers: {
      ofmTag(node) {
        const value = node.value;
        return `#${value}`;
      },
    },
  };
}
