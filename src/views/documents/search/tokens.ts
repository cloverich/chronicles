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

export type FilterToken = {
  type: "filter";
  value: NodeMatch;
};

export type JournalToken = {
  type: "in";
  value: string; // keyof Journals
};

export type FocusToken = {
  type: "focus";
  value: {
    type: string;
    content: string;
    depth: HeadingTag;
  };
};

export type SearchToken = FilterToken | JournalToken | FocusToken;
