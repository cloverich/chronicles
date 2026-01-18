/**
 * Plate.js v48 Compatibility Types
 *
 * This file provides backwards-compatible element/mark constants
 * for the v34 → v48 upgrade. The old exports like ELEMENT_H1, MARK_BOLD
 * are no longer exported from @udecode/plate. Instead, we define them
 * as string literals matching the plugin keys.
 *
 * @see docs/editor/plate-upgrade.md
 */

// Element type constants (backwards compatibility)
// These values match the plugin.key values in v48

// Paragraph
export const ELEMENT_PARAGRAPH = "p";

// Headings (from HEADING_KEYS in @udecode/plate-heading)
export const ELEMENT_H1 = "h1";
export const ELEMENT_H2 = "h2";
export const ELEMENT_H3 = "h3";
export const ELEMENT_H4 = "h4";
export const ELEMENT_H5 = "h5";
export const ELEMENT_H6 = "h6";

// Block elements
export const ELEMENT_BLOCKQUOTE = "blockquote";
export const ELEMENT_CODE_BLOCK = "code_block";

// Code block languages map (common languages for syntax highlighting)
export const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  diff: "Diff",
  go: "Go",
  graphql: "GraphQL",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kotlin: "Kotlin",
  markdown: "Markdown",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust",
  sql: "SQL",
  swift: "Swift",
  tsx: "TSX",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
};
export const ELEMENT_CODE_LINE = "code_line";
export const ELEMENT_CODE_SYNTAX = "code_syntax";

// Links
export const ELEMENT_LINK = "a";

// Lists
export const ELEMENT_UL = "ul";
export const ELEMENT_OL = "ol";
export const ELEMENT_LI = "li";
export const ELEMENT_LIC = "lic";

// Media
export const ELEMENT_IMAGE = "img";
export const ELEMENT_VIDEO = "video";
export const ELEMENT_MEDIA_EMBED = "media_embed";
export const ELEMENT_FILE = "file";
export const ELEMENT_IMAGE_GALLERY = "imageGalleryElement";

// Other elements
export const ELEMENT_TODO_LI = "action_item";
export const ELEMENT_TD = "td";

// Mark type constants (backwards compatibility)
export const MARK_BOLD = "bold";
export const MARK_ITALIC = "italic";
export const MARK_UNDERLINE = "underline";
export const MARK_STRIKETHROUGH = "strikethrough";
export const MARK_CODE = "code";
export const MARK_SUBSCRIPT = "subscript";
export const MARK_SUPERSCRIPT = "superscript";

// Heading keys array (for KEYS_HEADING)
export const KEYS_HEADING = [
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_H4,
  ELEMENT_H5,
  ELEMENT_H6,
];
