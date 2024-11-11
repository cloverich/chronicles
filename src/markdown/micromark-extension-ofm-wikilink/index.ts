declare module "micromark-util-types" {
  interface TokenTypeMap {
    ofmWikilink: "ofmWikilink";
    ofmWikilinkEmbeddingMarker: "ofmWikilinkEmbeddingMarker";
    ofmWikilinkOpenMarker: "ofmWikilinkOpenMarker";
    ofmWikilinkWhiteSpace: "ofmWikilinkWhiteSpace";
    ofmWikilinkPath: "ofmWikilinkPath";
    ofmWikilinkHashMarker: "ofmWikilinkHashMarker";
    ofmWikilinkHash: "ofmWikilinkHash";
    ofmWikilinkAliasMarker: "ofmWikilinkAliasMarker";
    ofmWikilinkAlias: "ofmWikilinkAlias";
    ofmWikilinkCloseMarker: "ofmWikilinkCloseMarker";
  }
}

export { ofmWikilinkHtml } from "./lib/html";
export { ofmWikilink } from "./lib/syntax";
