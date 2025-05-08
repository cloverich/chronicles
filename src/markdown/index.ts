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
import {
  unwrapAndGroupImagesSlate,
  wrapImagesForMdast,
} from "../views/edit/editor/features/images/toMdast.js";
import { ofmTagFromMarkdown, ofmTagToMarkdown } from "./mdast-util-ofm-tag";
import {
  ofmWikilinkFromMarkdown,
  ofmWikilinkToMarkdown,
} from "./mdast-util-ofm-wikilink";
import { ofmTag } from "./micromark-extension-ofm-tag";
import { ofmWikilink } from "./micromark-extension-ofm-wikilink";
import { mdastToSlate } from "./remark-slate-transformer/transformers/mdast-to-slate.js";

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

const visit = <T extends mdast.Node>(
  node: T,
  type: string,
  visitor: (node: T) => void,
) => {
  if (node.type === type) {
    visitor(node);
  }

  if ("children" in node) {
    for (const child of (node as any).children || []) {
      visit(child, type, visitor);
    }
  }
};

export const selectNoteLinks = (mdast: mdast.Root): mdast.Link[] => {
  const links: mdast.Link[] = [];
  visit<mdast.Link>(mdast as any, "link", (node: mdast.Link) => {
    if (isNoteLink(node)) {
      links.push(node);
    }
  });
  return links;
};

export const selectImageLinks = (node: mdast.Node): mdast.Image[] => {
  const images: mdast.Image[] = [];
  visit(node as any, "image", (image: mdast.Image) => {
    images.push(image);
  });
  return images;
};

/**
 * Return a list of distinct image urls from a document's nodes
 */
export const selectDistinctImageUrls = (node: mdast.Node): string[] => {
  const images = selectImageLinks(node);
  const urls = images.map((image) => image.url);
  return Array.from(new Set(urls));
};
