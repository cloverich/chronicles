import { slateToMdast } from "./remark-slate-transformer/index.js";
import * as SlateCustom from "./remark-slate-transformer/transformers/mdast-to-slate";

import * as mdast from "mdast";
export { slateToMdast } from "./remark-slate-transformer/transformers/slate-to-mdast.js";

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { ofmTagFromMarkdown } from "./mdast-util-ofm-tag";
import { ofmWikilinkFromMarkdown } from "./mdast-util-ofm-wikilink";
import { ofmTag } from "./micromark-extension-ofm-tag";
import { ofmWikilink } from "./micromark-extension-ofm-wikilink";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";

// stand-alone images are parsed as paragraphs with a single image child; this
// converts them to just the image node because in Slate rendering we don't want
// imges to be children of paragraphs. But note this will confuse the mdast serializer
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

// todo: Incorporate into mdast util properly, and do we need position nodes?
// see unwrap images; we need to re-wrap top-level images with paragraphs otherwise
// mdast-util-to-string FREAKS out and collapses all
function wrapImages(tree: mdast.Root) {
  tree.children = tree.children.map((child) => {
    if (child.type === "image") {
      return {
        type: "paragraph",
        children: [child],
      };
    }
    return child;
  });

  return tree;
}

// The importer has additional support for #tag and [[WikiLink]], but converts them
// to Chronicles tags and markdown links. Future versions may support these properly.
export const parseMarkdownForImport = (markdown: string): mdast.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm(), ofmTag(), ofmWikilink()],
    mdastExtensions: [
      gfmFromMarkdown(),
      ofmTagFromMarkdown(),
      ofmWikilinkFromMarkdown(),
    ],
  });
};

export const parseMarkdown = (markdown: string): mdast.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
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

export const slateToString = (nodes: SlateCustom.SlateNode[]) => {
  return mdastToString(wrapImages(slateToMdast(nodes)));
};
