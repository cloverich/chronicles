import { slateToMdast } from "./remark-slate-transformer/index.js";
import * as SlateCustom from "./remark-slate-transformer/transformers/mdast-to-slate";

import * as mdast from "mdast";
export { slateToMdast } from "./remark-slate-transformer/transformers/slate-to-mdast.js";

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { ofmWikilinkFromMarkdown } from "./mdast-util-ofm-wikilink";
import { ofmWikilink } from "./micromark-extension-ofm-wikilink";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";

// stand-alone images are parsed as paragraphs with a single image child; this
// converts them to just the image node
function unwrapImages(tree: mdast.Root) {
  tree.children = tree.children.map((child) => {
    if (
      child.type === "paragraph" &&
      child.children.length === 1 &&
      child.children[0].type === "image"
    ) {
      return child.children[0];
    }
    return child;
  });

  return tree;
}

export const parseMarkdown = (markdown: string): mdast.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm(), ofmWikilink()],
    mdastExtensions: [gfmFromMarkdown(), ofmWikilinkFromMarkdown()],
  });
};

export const mdastToString = (tree: mdast.Nodes) => {
  return toMarkdown(tree, {
    extensions: [gfmToMarkdown() as any],
    bullet: "-",
    emphasis: "_",
  });
};

export const stringToSlate = (input: string) => {
  return mdastToSlate(unwrapImages(parseMarkdown(input)));
};

// todo: nodes should be of type custom nodes, not as the base
// slate nodes... hmm...
export const slateToString = (nodes: SlateCustom.SlateNode[]) => {
  return mdastToString(slateToMdast(nodes));
};
