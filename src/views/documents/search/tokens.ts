// also defined in TagSearchStore
export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

// SearchRequest["nodeMatch"]
export type NodeMatch = {
  /**
   * Type of node
   *
   * https://github.com/syntax-tree/mdast#nodes
   */
  type: string; // type of Node
  /**
   * Match one or more attributes of a node
   */
  attributes?: Record<string, string | number>;
  text?: string; // match raw text from within the node
};

/**
 * NOTE: This is not currently implemented, but used to be
 */
export type FilterToken = {
  type: "filter";
  value: NodeMatch;
};

/**
 * Filter to documents in a particular journal
 */
export type JournalToken = {
  type: "in";
  value: string; // keyof Journals
  excluded?: boolean;
};

/**
 * NOTE: This is not currently implemented, but used to be
 */
export type FocusToken = {
  type: "focus";
  value: {
    type: string;
    content: string;
    depth: HeadingTag;
  };
};

export type TagToken = {
  type: "tag";
  value: string;
  excluded?: boolean;
};

/**
 * Searching documents by title
 */
export type TitleToken = {
  type: "title";
  value: string;
};

/**
 * Searching documents for raw text
 */
export type TextToken = {
  type: "text";
  value: string;
};

/**
 * Searching documents created after the given date string
 */
export type BeforeToken = {
  type: "before";
  value: string;
};

export type SearchToken =
  | FilterToken
  | JournalToken
  // | FocusToken
  | TagToken
  | TitleToken
  | TextToken
  | BeforeToken;
