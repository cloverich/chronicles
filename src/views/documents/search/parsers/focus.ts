import { FocusToken, SearchToken } from "../tokens";

export class FocusTokenParser {
  prefix = "focus:";
  serialize = (token: FocusToken) => {
    return `focus:${token.value.content}`;
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

/**
 * # foo -- Yes
 * ## foo -- Yes
 * #foo -- No
 * foo #bar # baz -- No
 */
const hRegex = /^(#+) (.*)/;

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

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function tagForDepth(text: string): HeadingTag {
  if (!text.length || text.length > 6) {
    console.warn(
      "tagForDepth expected between 1-6 hashes, but got ",
      text.length,
      text,
      "returning `h1` as a default",
    );
    return "h1";
  }

  return `h${text.length}` as HeadingTag;
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
