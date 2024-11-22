declare module "mdast" {
  interface OfmWikilink extends Literal {
    type: "ofmWikilink";
    url: string;
    hash: string;
    value: string;
  }

  interface OfmWikiEmbedding extends Literal {
    type: "ofmWikiembedding";
    url: string;
    hash: string;
    value: string;
  }

  interface RootContentMap {
    OfmWikilink: OfmWikilink;
    ofmWikiembedding: OfmWikiEmbedding;
  }

  interface PhrasingContentMap {
    ofmWikilink: OfmWikilink;
    ofmWikiembedding: OfmWikiEmbedding;
  }
}

export { ofmWikilinkFromMarkdown } from "./lib/fromMarkdown";
export { ofmWikilinkToMarkdown } from "./lib/toMarkdown";
