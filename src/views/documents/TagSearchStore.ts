import { computed, action, observable, IObservableArray } from "mobx";
import _ from "lodash";
import { SearchToken } from "./search/tokens";
import { FocusTokenParser } from "./search/parsers/focus";
import { JournalTokenParser } from "./search/parsers/in";
import { FilterTokenParser } from "./search/parsers/filter";
import { TitleTokenParser } from "./search/parsers/title";
import { TextTokenParser } from "./search/parsers/text";
import { BeforeTokenParser } from './search/parsers/before';

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
  focus: new FocusTokenParser(),
  in: new JournalTokenParser(),
  filter: new FilterTokenParser(),
  title: new TitleTokenParser(),
  text: new TextTokenParser(),
  before: new BeforeTokenParser(),
};

/**
 * Any object holding observable tokens can be used
 */
export interface ITokensStore {
  tokens: IObservableArray<SearchToken>;
  setTokens: (tokens: SearchToken[]) => void;
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

  /**
   * Add a raw array of (search string) tokens to the store
   * 
   * @param tokens - An array of strings representing tokens
   */
  @action
  addTokens = (tokens: string[]) => {
    // todo: Why am I not doing this atomically?
    for (const token of tokens) {
      this.addToken(token);
    }
  }

  @action
  addToken = (tokenStr: string) => {
    const results = this.parserFor(tokenStr);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.add(this.store.tokens, parsedToken);
    this.store.setTokens(tokens);
  };

  @action
  removeToken = (tokenStr: string) => {
    const results = this.parserFor(tokenStr);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.remove(this.store.tokens.slice(), parsedToken);
    this.store.setTokens(tokens);
  };
}
