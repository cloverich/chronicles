import unified from "unified";
import remarkParser, { RemarkParseOptions } from "remark-parse";
import remarkStringify, { RemarkStringifyOptions } from "remark-stringify";
import { Root } from "ts-mdast";

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
  return unified().use(remarkParser, opts);
}

function makeStringCompiler(opts: Partial<RemarkStringifyOptions>): any {
  return (
    unified()
      // yeah idk if adding the parser is needed here
      // or if adding the options, I think they are defaults
      // ¯\_(ツ)_/¯
      .use(remarkParser, { commonmark: true, gfm: true })
      .use(remarkStringify, opts)
  );
}

export const parser = makeParser({
  commonmark: true,
  gfm: true,
});

/**
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
