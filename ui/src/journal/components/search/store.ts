import { computed, action, reaction } from "mobx";
import {
  IJournalsUiStore,
  SearchToken,
  FilterToken,
  FocusToken,
  JournalToken,
} from "../../store";
import _ from "lodash";

// todo: define this type on the IJournalUiStore or the SearchStore, since it
// manages this query
import { SearchRequest } from "../../../client";

const tokenRegex = /^(.*):(.*)/;

interface TokenParser<T = any> {
  prefix: string;
  serialize: (token: T) => string;
  parse: (text: string) => T | undefined;
  add: (tokens: SearchToken[], token: T) => SearchToken[];
  remove: (tokens: SearchToken[], token: T) => SearchToken[];
}

class FocusTokenParser implements TokenParser<FocusToken> {
  prefix = "focus:";
  serialize = (token: FocusToken) => {
    return `focus:${token.value}`;
  };

  parse = (text: string): FocusToken | undefined => {
    if (!text) return undefined;
    return { type: "focus", value: parseHeading(text) };
  };

  add = (tokens: SearchToken[], token: FocusToken) => {
    // there can be only one...
    // This isn't the right place to put this business logic...
    const filtered = tokens.filter((t) => t.type !== "focus");
    filtered.push(token);

    return filtered;
  };

  remove = (tokens: SearchToken[], token: FocusToken) => {
    // Find the token matching this one... and remove it...
    return tokens.filter((t) => {
      // Keep all non-focus tokens
      if (t.type !== "focus") return true;

      // Remove if it matches...
      return (
        t.value.content !== token.value.content ||
        t.value.depth !== token.value.depth
      );
    });
  };
}

class JournalTokenParser implements TokenParser<JournalToken> {
  prefix = "journal:";
  serialize = (token: JournalToken) => {
    return this.prefix + token.value;
  };

  parse = (text: string): JournalToken | undefined => {
    if (!text) return;

    return { type: "in", value: text };
  };

  add = (tokens: SearchToken[], token: JournalToken) => {
    // there can be only one of each named journal
    // TODO: prevent adding journals with invalid names,
    // maybe accept a valid tokens property... where? Blargh...
    if (tokens.find((t) => t.type === "in" && t.value === token.value)) {
      return tokens;
    }

    // returning a copy is consistent with other methods,
    // but feels useless
    const copy = tokens.slice();
    copy.push(token);
    return copy;
  };

  remove = (tokens: SearchToken[], token: JournalToken) => {
    // Find the token matching this one... and remove it...
    return tokens.filter((t) => {
      // Keep all non-journal tokens
      if (t.type !== "in") return true;

      // Remove if it matches...
      return t.value !== token.value;
    });
  };
}

class FilterTokenParser implements TokenParser<FilterToken> {
  prefix = "filter:";
  serialize = (token: FilterToken) => {
    if (!token.value.attributes) {
      return this.prefix + token.value.text;
    }

    // As of now, filters can only specify one attribute
    const key = Object.keys(token.value.attributes)[0];
    const val = token.value.attributes[key];

    // ex: filter:code[lang="sql"]
    return `${this.prefix}${token.value.text}[${key}="${val}"]`;
  };

  equals = (token: FilterToken, token2: FilterToken) => {
    // Text match?
    if (token.value.text !== token2.value.text) return false;

    // If text matches and neither have attributes, they are equivalent
    // Otherwise, all attributes must match
    // isEqual handles both of these cases.
    return _.isEqual(token.value.attributes, token2.value.attributes);
  };

  parse = (text: string): FilterToken | undefined => {
    if (!text) return;
    const filter = parseFilter(text);
    if (!filter) return;

    return { type: "filter", value: filter };
  };

  add = (tokens: SearchToken[], token: FilterToken) => {
    // there can be only one...
    // This isn't the right place to put this
    const filtered = tokens.filter((t) => t.type !== "filter");
    filtered.push(token);

    return filtered;
  };

  remove = (tokens: SearchToken[], token: FilterToken) => {
    // Find the token matching this one... and remove it...
    return tokens.filter((t) => {
      // Keep all non-journal tokens
      if (t.type !== "filter") return true;

      // Remove if it matches...
      return !this.equals(t, token);
    });
  };
}

// todo: Type this as <SearchToken['type'], TokenParser<SearchToken>, where the type key matches
// a specific parser that corresponds to it.
const parsers: Record<SearchToken["type"], TokenParser<any>> = {
  focus: new FocusTokenParser(),
  in: new JournalTokenParser(),
  filter: new FilterTokenParser(),
};

/**
 * View model for displaying, adding, and removing search tokens
 */
export class TagSearchStore {
  constructor(private store: Pick<IJournalsUiStore, "tokens">) {}

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
    console.log("matches", matches);

    // todo: indicate to user we are discarding
    if (!matches) return;
    const [, prefix, value] = matches;
    // todo: same todo as above
    if (!value) return;

    const parser: TokenParser = (parsers as any)[prefix];
    console.log("parser", parser);
    if (!parser) return;

    const parsedToken = parser.parse(value);
    console.log("parsedToken", parsedToken);
    if (!parsedToken) return;

    return [parser, parsedToken];
  }

  @action
  addToken = (tokenStr: string) => {
    console.log("addToken!", tokenStr);
    const results = this.parserFor(tokenStr);
    console.log("results", results);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.add(this.store.tokens, parsedToken);
    console.log("replacing!", tokens);
    this.store.tokens.replace(tokens);
    console.log(this.store.tokens);
  };

  @action
  removeToken = (tokenStr: string) => {
    const results = this.parserFor(tokenStr);
    if (!results) return;

    const [parser, parsedToken] = results;
    const tokens = parser.remove(this.store.tokens, parsedToken);
    this.store.tokens.replace(tokens);

    // // TODO: removing tokens has too much logic.
    // // It should be easy to identify a token by id and remove it...
    // // Maube the token[] -> query translation is a reaction?
    // // That would allow removeToken to be simple and general

    // // validate its a journal
    // if (token.startsWith("focus:")) {
    //   this.store.focusHeading();
    // }

    // if (token.startsWith("filter:")) {
    //   const query = this.store.searchStore.query;
    //   this.store.searchStore.query = { journals: query.journals };
    // }

    // if (token.startsWith("in:")) {
    //   const journal = token.split("in:")[1];

    //   // If the search was for 'in:'
    //   if (!journal.length) return;

    //   const query = this.store.searchStore.query;
    //   if (query.journals.includes(journal)) {
    //     this.store.searchStore.query = {
    //       ...query,
    //       journals: query.journals.filter((j) => j !== journal),
    //     };
    //   }
    // }
  };
}

/**
 * # foo -- Yes
 * ## foo -- Yes
 * #foo -- No
 * foo #bar # baz -- No
 */
const hRegex = /^(#+) (.*)/;

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function tagForDepth(text: string): HeadingTag {
  if (!text.length || text.length > 6) {
    console.warn(
      "tagForDepth expected between 1-6 hashes, but got ",
      text.length,
      text,
      "returning `h1` as a default"
    );
    return "h1";
  }

  return `h${text.length}` as HeadingTag;
}

/**
 * Get the text part of a heading search.
 *
 * Could be combined with extractHeading because of how I use it, but
 * good design is unclear to me atm.
 *
 * @param text -- search token for heading
 */
function parseHeadingText(text: string): string {
  const matches = text.match(hRegex);
  if (!matches) return text;
  return matches[2];
}

/**
 * Parse a token as a focused heading command, convert
 * the text part to a node search query (i.e. searchStore.query.node)
 *
 * todo: Refactor searchStore.query.node to be more generic, and
 * to have a first class name (like "node search")
 * @param text
 */
function parseHeading(text: string) {
  // ['##', 'search text']
  const matches = text.match(hRegex);

  if (!matches) {
    // Infer h1, preprend '# ' to search
    return {
      type: "heading",
      content: "# " + text,
      depth: "h1" as HeadingTag,
    };
  } else {
    return {
      type: "heading",
      content: text, //matches[2],
      depth: tagForDepth(matches[1]),
    };
  }
}

/**
 * Parse filter: tags to generate search queries matching nodes
 * by type and attributes.
 *
 * todo: merge into FilterTokenParser.parse
 *
 * @param token - search string from the tag search input; no assumptions about its structure.
 */
function parseFilter(token: string): SearchRequest["nodeMatch"] {
  const nodeAttrMatch = token.match(nodeAttributeRegex);
  if (nodeAttrMatch) {
    const [nodeType, attribute, value] = nodeAttrMatch.slice(1);
    if (!value) {
      console.error(
        "parseFilter.nodeAttrMatch could not match all segments for",
        token,
        "matched:",
        nodeType,
        attribute,
        value
      );
      return;
    }
    return {
      type: nodeType,
      attributes: {
        [attribute]: value,
      },
    };
  } else {
    const nodeMatch = token.match(nodeRegex);
    if (nodeMatch && nodeTypes.includes(nodeMatch[1])) {
      console.log("nodeMatch", nodeMatch[1]);
      return {
        type: nodeMatch[1],
        text: undefined,
      };
    }
  }
}

/**
 * Interpret a node query as a filter command, and stringify it for display.
 * This is how a node query is represented in the search interface.
 *
 * @param filter
 */
function formatFilter(filter: SearchRequest["nodeMatch"]) {
  if (filter?.attributes) {
    // Right now, a filter token is only capable of specifying a single attribute.
    // ... this is going to be difficult to keep track of
    const key = Object.keys(filter.attributes)[0];
    return `filter:${filter.type}[${key}="${filter.attributes[key]}"]`;
  } else {
    return `filter:${filter!.type}`;
  }
}

/**
 * Node types someone might search on
 * https://github.com/syntax-tree/mdast#nodes
 */
const nodeTypes = [
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "html",
  "code",
  "definition",
  "footnoteDefinition",
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "break",
  "link",
  "image",
  "linkReference",
  "imageReference",
  "footnote",
  "footnoteReference",
];

// to match filter:code[lang="sql"]
/**
 * filter:code
filter:code[lang="sql"]
filter:code[lang=
filter:code[
filter:heading[level="2"]:contains("foo bar baz")

 * will match: filter:code[lang="sql"] into [_, code, lang, sql]
 */
const nodeAttributeRegex = /^(\w+)\[(.*)="(.*)"\]$/;

// to match filter:code
const nodeRegex = /^(\w+)$/;
