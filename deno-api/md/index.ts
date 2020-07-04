import { createRequire } from "https://deno.land/std@v0.59.0/node/module.ts";

const require = createRequire(import.meta.url);
const remarkParser = require("remark-parse");
const remarkStringify = require("remark-stringify");
const unified = require("unified");

import { Root } from "./types/mdast.d.ts";
import { RemarkParseOptions } from "./types/remark-parse.d.ts";
import {
  RemarkStringifyOptions,
  Stringify,
} from "./types/remark-stringify.d.ts";

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
function makeParser(opts: Partial<RemarkParseOptions>): Parser {
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

export const parser: Parser = makeParser({
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
