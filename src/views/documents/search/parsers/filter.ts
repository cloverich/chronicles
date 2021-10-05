import _ from "lodash";
import { FilterToken, SearchToken, NodeMatch } from "../tokens";

export class FilterTokenParser {
  prefix = "filter:";
  serialize = (token: FilterToken) => {
    if (!token.value.attributes) {
      return this.prefix + token.value.type;
    }

    // As of now, filters can only specify one attribute
    const key = Object.keys(token.value.attributes)[0];
    const val = token.value.attributes[key];

    // ex: filter:code[lang="sql"]
    return `${this.prefix}${token.value.type}[${key}="${val}"]`;
  };

  equals = (token: FilterToken, token2: FilterToken) => {
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

/**
 * Parse filter: tags to generate search queries matching nodes
 * by type and attributes.
 *
 * todo: merge into FilterTokenParser.parse
 *
 * @param token - search string from the tag search input; no assumptions about its structure.
 */
function parseFilter(token: string): NodeMatch | undefined {
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
function formatFilter(filter: NodeMatch) {
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

/**
 * `filter:code[lang="sql"]` -> [_, code, lang, sql]
 */
const nodeAttributeRegex = /^(\w+)\[(.*)="(.*)"\]$/;

// to match filter:code
const nodeRegex = /^(\w+)$/;
