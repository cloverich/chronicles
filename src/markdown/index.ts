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
  return mdastToSlate(unwrapImages(parse(input)));
};

export const slateToString = (nodes: SlateCustom.SlateNode[]) => {
  return mdastToString(wrapImages(slateToMdast(nodes)));
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
