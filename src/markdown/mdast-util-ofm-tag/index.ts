declare module "mdast" {
  interface OfmTag extends Literal {
    type: "ofmTag";
    value: string;
  }

  interface RootContentMap {
    ofmTag: OfmTag;
  }

  interface PhrasingContentMap {
    ofmTag: OfmTag;
  }
}

export { ofmTagFromMarkdown } from "./lib/fromMarkdown.js";
export { ofmTagToMarkdown } from "./lib/toMarkdown.js";
