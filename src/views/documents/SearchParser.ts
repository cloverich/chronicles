import { SearchToken } from "./search/tokens";
// import { FocusTokenParser } from "./search/parsers/focus";
import { BeforeTokenParser } from "./search/parsers/before";
import { DateTokenParser } from "./search/parsers/date";
import { FilterTokenParser } from "./search/parsers/filter";
import { JournalTokenParser } from "./search/parsers/in";
import { TagTokenParser } from "./search/parsers/tag";
import { TextTokenParser } from "./search/parsers/text";
import { TitleTokenParser } from "./search/parsers/title";

// TODO: This won't allow searching where value has colon in it
const tokenRegex = /^(.*):(.*)/;

interface TokenParser<T = any> {
  prefix: string;
  serialize: (token: T) => string;
  parse: (text: string) => T | undefined;
  add: (tokens: SearchToken[], token: T) => SearchToken[];
  remove: (tokens: SearchToken[], token: T) => SearchToken[];
}

// todo: Type this as <SearchToken['type'], TokenParser<SearchToken>, where the type key matches
// a specific parser that corresponds to it.
const parsers: Record<SearchToken["type"], TokenParser<any>> = {
  // focus: new FocusTokenParser(),
  in: new JournalTokenParser(),
  filter: new FilterTokenParser(),
  tag: new TagTokenParser(),
  title: new TitleTokenParser(),
  text: new TextTokenParser(),
  before: new BeforeTokenParser(),
  date: new DateTokenParser(),
};

/**
 * Helper for parsing, adding, and removing search tokens
 */
export class SearchParser {
  serializeToken = (token: SearchToken) => {
    const parser = parsers[token.type];
    return parser.serialize(token);
  };

  /**
   * For a given search component (ex: in:chronicles), get the right parser
   * and the parsed value (ex: { type: 'in', value: 'chronicles' })
   *
   * @param tokenStr - The raw string from the search input
   */
  private parseFor<SearchToken>(
    tokenStr: string,
  ): [TokenParser<SearchToken>, SearchToken] | undefined {
    if (!tokenStr) return;
    const matches = tokenStr.match(tokenRegex);

    // accept free text and convert to text: token types
    // ex: "banana pudding" -> "text:banana pudding"
    if (!matches) {
      return [parsers.text, parsers.text.parse(tokenStr)];
    }

    let [, prefix, value] = matches;
    if (!value) return;

    let excluded = false;
    if (prefix.startsWith("-")) {
      excluded = true;
      prefix = prefix.substring(1);
    }

    const parser: TokenParser = (parsers as any)[prefix];
    if (!parser) return;

    const parsedToken = parser.parse(value);
    if (!parsedToken) return;

    if (excluded) {
      (parsedToken as any).excluded = true;
    }

    return [parser, parsedToken];
  }

  parseToken = (tokenStr: string) => {
    const results = this.parseFor(tokenStr);
    if (!results) return;

    const [_, parsedToken] = results;
    return parsedToken;
  };

  parseTokens = (tokenStr: string[]) => {
    let parsedTokens: SearchToken[] = [];
    tokenStr.forEach((token) => {
      const parsedToken = this.parseToken(token);
      if (!parsedToken) return;

      // todo: fix type
      parsedTokens.push(parsedToken as any);
    });

    return parsedTokens;
  };

  mergeToken = (tokens: SearchToken[], token: SearchToken) => {
    const parser = parsers[token.type];
    return parser.add(tokens, token);
  };

  removeToken = (tokens: any[], tokenStr: string) => {
    const results = this.parseFor(tokenStr);
    if (!results) return tokens;

    const [parser, parsedToken] = results;
    return parser.remove(tokens, parsedToken);
  };
}
