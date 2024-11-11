import type { Extension } from "mdast-util-from-markdown";

/**
 * Create an extension for `mdast-util-from-markdown` to enable OFM wikilinks in markdown.
 */
export function ofmWikilinkFromMarkdown(): Extension {
  return {
    enter: {
      ofmWikilink(token) {
        this.enter(
          {
            type: "ofmWikilink",
            url: "",
            hash: "",
            value: "",
          },
          token,
        );
      },
      ofmWikilinkEmbeddingMarker() {
        const node = this.stack[this.stack.length - 1];
        node.type = "ofmWikiembedding";
      },
      ofmWikilinkPath(token) {
        const node = this.stack[this.stack.length - 1];
        if (node.type === "ofmWikilink" || node.type === "ofmWikiembedding") {
          const content = this.sliceSerialize(token);
          node.url = content;

          const parts = content.split("/");
          const file = parts[parts.length - 1];
          if (file.includes("."))
            node.value = file.split(".").slice(0, -1).join(".");
          else node.value = file;
        }
      },
      ofmWikilinkHash(token) {
        const node = this.stack[this.stack.length - 1];
        if (node.type === "ofmWikilink" || node.type === "ofmWikiembedding") {
          node.hash = this.sliceSerialize(token);
        }
      },
      ofmWikilinkAlias(token) {
        const node = this.stack[this.stack.length - 1];
        if (node.type === "ofmWikilink" || node.type === "ofmWikiembedding") {
          node.value = this.sliceSerialize(token);
        }
      },
    },
    exit: {
      ofmWikilink(token) {
        this.exit(token);
      },
    },
  };
}
