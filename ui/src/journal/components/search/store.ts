import { computed, action } from "mobx";
import { IJournalsUiStore } from "../../store";

// todo: define this type on the IJournalUiStore or the SearchStore, since it
// manages this query
import { SearchRequest } from "../../../client";

/**
 * View model for displaying, adding, and removing search tokens
 */
export class TagSearchStore {
  constructor(private store: IJournalsUiStore) {}

  /**
   * Format the search query for display in the search interface.
   */
  @computed
  get searchTokens() {
    // Technically, cannot represent both a focus: and a filter: since query.nodeMatch is singular...
    const filters = this.store.isFiltered
      ? formatFilter(this.store.searchStore.query.nodeMatch)
      : undefined;
    return [
      filters,
      ...this.store.selectedJournals.map((j) => `in:${j}`),
      this.store.focusedHeading
        ? `focus:${parseHeadingText(this.store.focusedHeading.content)}`
        : undefined,
    ].filter((value) => value) as string[];
  }

  @action
  addToken = (token: string) => {
    if (token.startsWith("focus:")) {
      const text = token.split("focus:")[1];
      if (!text.length) {
        console.warn("Ignoring ", token, "because no content found");
        return;
      } else {
        this.store.focusHeading(parseHeading(text));
      }
    }

    // detect duplicates
    // error if token already found...
    // validate its a journal
    if (token.startsWith("in:")) {
      const journal = token.split("in:")[1];
      const query = this.store.searchStore.query;
      if (query.journals.includes(journal)) {
        // Journal already in search, do nothing (or warn)
        console.info(
          "skipping search because journal already in search",
          journal
        );
      } else {
        // Add journal to search, if its a known journal
        if (this.store.journals.find((j) => j.name === journal)) {
          this.store.searchStore.query = {
            ...query,
            journals: [...query.journals, journal],
          };
        }
      }
    }

    // blargh, if cannot support focused heading and filter right now...
    // So when I do this part.. i need to strip the focused heading.
    if (token.startsWith("filter:")) {
      const filter = parseFilter(token);
      if (!filter) {
        console.warn("Ignoring ", token, "because no selector found");
        return;
      }

      const query = this.store.searchStore.query;
      this.store.focusHeading();
      this.store.searchStore.query = {
        ...query,
        nodeMatch: filter,
      };
    }
  };

  @action
  removeToken = (token: string) => {
    // TODO: removing tokens has too much logic.
    // It should be easy to identify a token by id and remove it...
    // Maube the token[] -> query translation is a reaction?
    // That would allow removeToken to be simple and general

    // validate its a journal
    if (token.startsWith("focus:")) {
      this.store.focusHeading();
    }

    if (token.startsWith("filter:")) {
      const query = this.store.searchStore.query;
      this.store.searchStore.query = { journals: query.journals };
    }

    if (token.startsWith("in:")) {
      const journal = token.split("in:")[1];

      // If the search was for 'in:'
      if (!journal.length) return;

      const query = this.store.searchStore.query;
      if (query.journals.includes(journal)) {
        this.store.searchStore.query = {
          ...query,
          journals: query.journals.filter((j) => j !== journal),
        };
      }
    }
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
const nodeAttributeRegex = /^filter:(\w+)\[(.*)="(.*)"\]$/;

// to match filter:code
const nodeRegex = /^filter:(\w+)$/;
