import { slateToMdast } from "./remark-slate-transformer/index.js";
import * as SlateCustom from "./remark-slate-transformer/transformers/mdast-to-slate";

import * as mdast from "mdast";
export { slateToMdast } from "./remark-slate-transformer/transformers/slate-to-mdast.js";

import { fromMarkdown } from "mdast-util-from-markdown";
import {
  frontmatterFromMarkdown,
  frontmatterToMarkdown,
} from "mdast-util-frontmatter";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { ofmTagFromMarkdown, ofmTagToMarkdown } from "./mdast-util-ofm-tag";
import {
  ofmWikilinkFromMarkdown,
  ofmWikilinkToMarkdown,
} from "./mdast-util-ofm-wikilink";
import { ofmTag } from "./micromark-extension-ofm-tag";
import { ofmWikilink } from "./micromark-extension-ofm-wikilink";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";

// Needed because we augment mdast with the new imageGroupElement; see below. Note
// this is the _documented_ way to extend mdast types.
declare module "mdast" {
  interface ImageGroupElement extends Literal {
    type: "imageGroupElement";
    children: Image[];
  }

  interface RootContentMap {
    imageGroupElement: ImageGroupElement;
  }
}

// The unwrap code below now handles both unwrapping images (legacy issue), and
// converting consecutive images to image group elements. Ideally the imageGroupElement
// concept exists in our custom slate dom and not mdast but its easiest to put it into
// mdast for now, b/c of how the parsing is architected. Also, this module extension,
// parsing, etc, should be moved to features/image-grouping or something.
function unwrapAndGroupImagesSlate(tree: mdast.Root): mdast.Root {
  const children: mdast.Content[] = [];
  let imageNodes: mdast.Image[] = [];

  const flushBuffer = () => {
    if (imageNodes.length === 0) return;

    if (imageNodes.length === 1) {
      children.push(imageNodes[0]);
    } else {
      children.push({
        type: "imageGroupElement",
        children: imageNodes,
      } as any); // Cast to any or extend mdast types
    }

    imageNodes = [];
  };

  for (const node of tree.children) {
    if (
      node.type === "paragraph" &&
      node.children.length === 1 &&
      node.children[0].type === "image"
    ) {
      // unwrap image nodes.
      // stand-alone images are parsed as paragraphs with a single image child; this
      // converts them to just the image node because in Slate rendering we don't want
      // imges to be children of paragraphs. This process must be reversed when going
      // back to mdast; see wrapImagesForMdast below.
      imageNodes.push(node.children[0] as mdast.Image);
    } else {
      flushBuffer();
      children.push(node);
    }
  }

  flushBuffer();
  tree.children = children;
  return tree;
}

// reverse unwrapImages from above
// todo: this was written prior to the micromark, still necessary?
// todo: Is this code stripping relevant positioning information?
function wrapImagesForMdast(tree: mdast.Root) {
  tree.children = tree.children.map((node) => {
    if (node.type === "image") {
      return {
        type: "paragraph",
        children: [node],
      };
    }
    return node;
  });

  return tree;
}

// During import (processing) parse #tag and [[WikiLink]]; importer converts them
// to Chronicles tags and markdown links. Future versions may support these properly.
export const parseMarkdownForImportProcessing = (
  markdown: string,
): mdast.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm(), ofmTag(), ofmWikilink(), frontmatter(["yaml"])],
    mdastExtensions: [
      gfmFromMarkdown(),
      ofmTagFromMarkdown(),
      ofmWikilinkFromMarkdown(),
      // https://github.com/micromark/micromark-extension-frontmatter?tab=readme-ov-file#preset
      frontmatterFromMarkdown(["yaml"]),
    ],
  });
};

export const serializeMarkdownForImportProcessing = (tree: mdast.Nodes) => {
  return toMarkdown(tree, {
    extensions: [
      gfmToMarkdown() as any,
      ofmTagToMarkdown(),
      ofmWikilinkToMarkdown(),
      frontmatterToMarkdown(["yaml"]),
    ],
    bullet: "-",
    emphasis: "_",
  });
};

export const parseMarkdown = (markdown: string): mdast.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm(), frontmatter(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])],
  });
};

export const mdastToString = (tree: mdast.Nodes) => {
  return toMarkdown(tree, {
    extensions: [gfmToMarkdown() as any, frontmatterToMarkdown(["yaml"])],
    bullet: "-",
    emphasis: "_",
  });
};

// parser param: support configuring for importer tests, which import and convert
// a few otherwise unsupported markdown features (tags, wikilinks)
export const stringToSlate = (input: string, parse = parseMarkdown) => {
  return mdastToSlate(unwrapAndGroupImagesSlate(parse(input)));
};

export const slateToString = (nodes: SlateCustom.SlateNode[]) => {
  return mdastToString(wrapImagesForMdast(slateToMdast(nodes)));
};

// is a markdown link a link to another note?
// NOTE: Confusing name; dont have a distinct noteLink type in mdast, maybe
// should be targetsNote or something
export const isNoteLink = (mdast: mdast.RootContent): mdast is mdast.Link => {
  if (mdast.type !== "link") return false;

  // we are only interested in markdown links
  if (!mdast.url.endsWith(".md")) return false;

  // ensure its not a url with an .md domain
  if (mdast.url.includes("://")) return false;

  return true;
};

export const selectNoteLinks = (
  mdast: mdast.Content | mdast.Root,
): mdast.Link[] => {
  const links: mdast.Link[] = [];
  if (mdast.type === "link" && isNoteLink(mdast)) {
    links.push(mdast);
  } else if ("children" in mdast) {
    for (const child of mdast.children as any) {
      links.push(...selectNoteLinks(child));
    }
  }
  return links;
};
