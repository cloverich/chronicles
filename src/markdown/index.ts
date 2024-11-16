import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnwrapImages from "remark-unwrap-images";
import { Node as SNode } from "slate";
import { unified } from "unified";
import {
  remarkToSlate,
  slateToMdast,
  slateToRemark,
} from "./remark-slate-transformer/index.js";

import * as Mdast2 from "mdast";
import * as Mdast from "ts-mdast";
export * from "ts-mdast";
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
function unwrapImages(tree: Mdast2.Root) {
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

export const parseMarkdown = (markdown: string): Mdast2.Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm(), ofmWikilink()],
    mdastExtensions: [gfmFromMarkdown(), ofmWikilinkFromMarkdown()],
  });
};

export const mdastToString = (tree: Mdast2.Nodes) => {
  return toMarkdown(tree, {
    extensions: [gfmToMarkdown() as any],
    bullet: "-",
    emphasis: "_",
  });
};

export const stringToSlate = (input: string) => {
  return mdastToSlate(unwrapImages(parseMarkdown(input)));
};

export const slateToString = (nodes: SNode[]) => {
  return mdastToString(slateToMdast(nodes));
};

// export function stringToMdastLegacy(text: string): any {
//   return parser.parse(text) as any as Mdast.Root;
// }

// I usually forget how unified works, so just leaving some notes for reference
// https://github.com/orgs/unifiedjs/discussions/113
// | ........................ process ........................... |
// | .......... parse ... | ... run ... | ... stringify ..........|
//
//           +--------+                     +----------+
// Input ->- | Parser | ->- Syntax Tree ->- | Compiler | ->- Output
//           +--------+          |          +----------+
//                               X
//                               |
//                        +--------------+
//                        | Transformers |
//                        +--------------+
// NOTE: The type error below is wrong, this definitely works becaus of
// esmoduleInterop...
const stringifierLegacy = unified().use(remarkStringify);
const parserLegacy = unified().use(remarkParse).use(remarkGfm);

const slateToStringProcessorLegacy = unified()
  .use(slateToRemark)
  .use(remarkGfm)
  .use(remarkStringify);

const stringToSlateProcessorLegacy = parserLegacy
  // plugin to remove the wrapping paragraph (<p>) for images (<img>).
  // but supposedly only works on html / rehype shrug
  .use(remarkUnwrapImages)
  .use(remarkToSlate);

export function stringToSlateLegacy(text: string) {
  // remarkToSlate must use a newer version, where file.result exists
  // file.contents also exists here... maybe the compilers are overlapping since
  // they modify in place? shrug
  // https://github.com/unifiedjs/unified/releases/tag/9.0.0
  // const output = stringToSlateProcessor.processSync(text);
  const mdast = stringToSlateProcessorLegacy.parse(text);
  // console.log("mdast", JSON.stringify(mdast, null, 2));
  const transformed = stringToSlateProcessorLegacy.runSync(mdast);
  // console.log("transformed", JSON.stringify(transformed, null, 2));
  const output = stringToSlateProcessorLegacy.stringify(transformed);
  // console.log("output", JSON.stringify(output, null, 2));
  // return (output as any).result;
  return output as any;
}

/**
 * debug helper function to see the slate to mdast conversion
 * before stringifying
 */
export function slateToMdastLegacy(nodes: SNode[]): Mdast.Root {
  return slateToStringProcessorLegacy.runSync({
    type: "root",
    children: nodes,
  }) as any as Mdast.Root;
}

export function slateToStringLegacy(nodes: SNode[]): string {
  // per documentation https://github.com/inokawa/remark-slate-transformer/
  // slate value must be wrapped. Remark's parse expects a string while `run`
  // operates on ASTs
  const ast = slateToStringProcessorLegacy.runSync({
    type: "root",
    children: nodes,
  });

  return slateToStringProcessorLegacy.stringify(ast) as any as string;
}
