declare module "micromark-util-types" {
  interface TokenTypeMap {
    ofmTag: "ofmTag";
    ofmTagMarker: "ofmTagMarker";
    ofmTagContent: "ofmTagContent";
  }
}

// export { ofmTagHtml } from "./lib/html.js";
export { ofmTag } from "./lib/syntax.js";
