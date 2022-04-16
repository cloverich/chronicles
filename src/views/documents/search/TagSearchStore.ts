import { computed, action, observable, IObservableArray } from "mobx";
import _ from "lodash";
import { SearchToken } from "./tokens";
import { FocusTokenParser } from "./parsers/focus";
import { JournalTokenParser } from "./parsers/in";
import { FilterTokenParser } from "./parsers/filter";
import { TitleTokenParser } from "./parsers/title";
import { TextTokenParser } from "./parsers/text";

// NOTE: This won't allow searching where value has colon in it
// Feel free to improe this
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
  focus: new FocusTokenParser(),
  in: new JournalTokenParser(),
  filter: new FilterTokenParser(),
  title: new TitleTokenParser(),
  text: new TextTokenParser(),
};

/**
 * Any object holding observable tokens can be used
 */
export interface ITokensStore {
  tokens: IObservableArray<SearchToken>;
}

/**
 * View model for displaying, adding, and removing search tokens
 */
export class TagSearchStore {
  constructor(private store: ITokensStore) { }

  // TODO: Rename. These are stringified tokens, not SearchToken's
  // which is confusing?
  @computed
  get searchTokens() {
    return this.store.tokens.map((token) => {
      const parser = parsers[token.type];
      return parser.serialize(token);
    });
  }

  /**
   * For a given search (string), get the right parser
   * and the parsed value.
   *
   * @param tokenStr - The raw string from the search input
   */
  private parserFor<SearchToken>(
    tokenStr: string
  ): [TokenParser<SearchToken>, SearchToken] | undefined {
    if (!tokenStr) return;
    const matches = tokenStr.match(tokenRegex);


    // accept free text and convert to text: token types
    // ex: "banana pudding" -> "text:banana pudding"
    if (!matches) {
      return [parsers.text, parsers.text.parse(tokenStr)]
    };

    const [, prefix, value] = matches;
    // todo: same todo as above
    if (!value) return;

    const parser: TokenParser = (parsers as any)[prefix];
    if (!parser) return;

    const parsedToken = parser.parse(value);
    if (!parsedToken) return;

    return [parser, parsedToken];
  }

  @action
  addToken = (tokenStr: string) => {
    const results = this.parserFor(tokenStr);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.add(this.store.tokens, parsedToken);

    this.store.tokens = observable(tokens);
  };

  @action
  removeToken = (tokenStr: string) => {
    const results = this.parserFor(tokenStr);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.remove(this.store.tokens.slice(), parsedToken);
    this.store.tokens = observable(tokens);
  };
}
