import type { HtmlExtension } from "micromark-util-types";

/**
 * Create an HTML extension for `micromark` to support OFM wikilinks when
 * serializing to HTML.
 */
export function ofmWikilinkHtml(): HtmlExtension {
  let url = "";
  let value = "";
  let embedded = false;

  return {
    enter: {
      ofmWikilink() {
        url = "";
        value = "";
        embedded = false;
      },
      ofmWikilinkEmbeddingMarker() {
        embedded = true;
      },
      ofmWikilinkPath(token) {
        const content = this.sliceSerialize(token);
        url = content;

        const parts = content.split("/");
        value = parts[parts.length - 1];
        if (value.includes("."))
          value = value.split(".").slice(0, -1).join(".");
      },
      ofmWikilinkHash(token) {
        url += `#${this.sliceSerialize(token)}`;
      },
      ofmWikilinkAlias(token) {
        value = this.sliceSerialize(token);
      },
    },
    exit: {
      ofmWikilink() {
        const anchor = `<a href="${url}">${value}</a>`;
        if (embedded) this.tag(`<iframe src="${url}">${anchor}</iframe>`);
        else this.tag(anchor);
      },
    },
  };
}
