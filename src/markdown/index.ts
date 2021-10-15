import unified from "unified";
import remarkParse, { RemarkParseOptions } from "remark-parse";
import remarkStringify, { RemarkStringifyOptions } from "remark-stringify";
import { Root } from "ts-mdast";
// https://github.com/inokawa/remark-slate-transformer/
// import { slateToRemark } from "remark-slate-transformer";
import {
  remarkToSlate,
  slateToRemark,
  slateToMdast,
} from "./remark-slate-transformer";
import { Node as SNode } from "slate";

export * from "ts-mdast";

import { unnestImages } from "./unnestImages";

// On remark versions > 12 I think they moved to micromark, which lost the
// gfm option and instead requires this package
import remarkGfm from "remark-gfm";

/**
 * The types from remark-parse say it accepts no arguments for parse.
 * Unfied says it accepts a VFile, of which string is one type.
 *
 * Here I'm simplifying to say it accepts a string, and returns an MDAST Root.
 *
 * I do not fully understand the unified ecosystem but these captures the subset I
 * am currently interested in.
 *
 * TODO: Clean this all up. Figure out if I should care about the more sophisticated
 * parser behaviors and whether I can fork and group all of this up into a Deno package.
 */
interface Parser {
  parse(contents: string): Root;
}

// Wrap parser creation so I can signify it takes Partial<RemarkParseOptions>
function makeParser(opts: Partial<RemarkParseOptions>) {
  return unified().use(remarkParse, opts);
}

function makeStringCompiler(opts: Partial<RemarkStringifyOptions>): any {
  return (
    unified()
      // yeah idk if adding the parser is needed here
      // or if adding the options, I think they are defaults
      // ¯\_(ツ)_/¯
      .use(remarkParse, { commonmark: true, gfm: true })
      .use(remarkStringify, opts)
  );
}

export const parser = makeParser({
  commonmark: true,
  gfm: true,
});

/**
 * NOTE: When I consolidated this file, this was only used in legacy contexts.
 * Once a new indexing strategy is devised revisit this
 *
 * I added this so I could stringify Nodes after parsing, for indexing
 * specific node text which might otherwise have child nodes.
 *
 * Its not the best idea, because it may not serialize back with the
 * same exact text that came in. So, this is useful for POC but longer term...
 * I'll need to do something a little smarter perhaps.
 */
export const stringifier = makeStringCompiler({
  commonmark: true,
  gfm: true,
});

const slateToStringProcessor = unified()
  .use(slateToRemark)
  .use(remarkStringify);

const stringToSlateProcessor = unified()
  .use(remarkParse)
  .use(unnestImages)
  .use(remarkToSlate);

export function stringToSlate(text: string) {
  // remarkToSlate must use a newer version, where file.result exists
  // file.contents also exists here... maybe the compilers are overlapping since
  // they modify in place? shrug
  // https://github.com/unifiedjs/unified/releases/tag/9.0.0
  // const output = stringToSlateProcessor.processSync(text);
  const mdast = stringToSlateProcessor.parse(text);
  console.log("mdast", JSON.stringify(mdast, null, 2));
  const transformed = stringToSlateProcessor.runSync(mdast);
  console.log("transformed", JSON.stringify(transformed, null, 2));
  const output = stringToSlateProcessor.stringify(transformed);
  console.log("output", JSON.stringify(output, null, 2));
  // return (output as any).result;
  return output as any;
}

export function slateToString(nodes: SNode[]) {
  // per documentation https://github.com/inokawa/remark-slate-transformer/
  // slate value must be wrapped. Remark's parse expects a string while `run`
  // operates on ASTs
  const ast = slateToStringProcessor.runSync({
    type: "root",
    children: nodes,
  });

  return slateToStringProcessor.stringify(ast);
}
