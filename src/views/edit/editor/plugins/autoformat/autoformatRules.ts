import { AutoformatRule } from "@udecode/plate-autoformat";
import { insertEmptyCodeBlock } from "@udecode/plate-code-block";

import {
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_LI,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_UL,
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from "../../plate-types";

import { formatList, preFormat } from "./autoformatUtils";

// These rules are configuration for autoformat plugin, pulled from plate docs at
// https://platejs.org/docs/autoformat#autoformatrules
// Consolidated and simplified the rules configuration into this single file.

/**
 * Query function to disable autoformat rules inside code blocks.
 * Returns false (skip rule) when selection is inside a code_block or code_line.
 * @see https://github.com/cloverich/chronicles/issues/332
 */
const notInCodeBlock = (editor: any): boolean => {
  return !editor.api.some({
    match: { type: [ELEMENT_CODE_BLOCK, ELEMENT_CODE_LINE] },
  });
};

export const autoformatRules: AutoformatRule[] = [
  {
    mode: "block",
    type: ELEMENT_H1,
    match: "# ",
    preFormat,
    query: notInCodeBlock,
  },
  {
    mode: "block",
    type: ELEMENT_H2,
    match: "## ",
    preFormat,
    query: notInCodeBlock,
  },
  {
    mode: "block",
    type: ELEMENT_H3,
    match: "### ",
    preFormat,
    query: notInCodeBlock,
  },

  // I don't intend to support H4-H6 at this time
  // {
  //   mode: "block",
  //   type: ELEMENT_H4,
  //   match: "#### ",
  //   preFormat,
  // },
  // {
  //   mode: "block",
  //   type: ELEMENT_H5,
  //   match: "##### ",
  //   preFormat,
  // },
  // {
  //   mode: "block",
  //   type: ELEMENT_H6,
  //   match: "###### ",
  //   preFormat,
  // },
  {
    mode: "block",
    type: ELEMENT_BLOCKQUOTE,
    match: "> ",
    preFormat,
    query: notInCodeBlock,
  },
  {
    mode: "block",
    type: ELEMENT_LI,
    match: ["* ", "- "],
    preFormat,
    format: (editor) => formatList(editor, ELEMENT_UL),
    query: notInCodeBlock,
  },
  {
    mode: "block",
    type: ELEMENT_LI,
    match: ["1. ", "1) "],
    preFormat,
    format: (editor) => formatList(editor, ELEMENT_OL),
    query: notInCodeBlock,
  },
  // Inline code: single backtick wrapping text like `code`
  // Must be before code block rule so it's checked first
  // Note: We intentionally do NOT add notInCodeBlock here since backticks
  // in code blocks are just regular characters and won't trigger mark formatting
  {
    mode: "mark",
    type: MARK_CODE,
    match: "`",
    query: notInCodeBlock,
  },
  // Code block: triple backticks followed by space at start of line
  // Note: This rule only applies outside code blocks (you can't nest code blocks)
  {
    mode: "block",
    type: ELEMENT_CODE_BLOCK,
    match: "```",
    preFormat,
    format: (editor) => {
      insertEmptyCodeBlock(editor as any, {
        defaultType: ELEMENT_PARAGRAPH,
        insertNodesOptions: { select: true },
      });
    },
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: [MARK_BOLD, MARK_ITALIC],
    match: "***",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_ITALIC],
    match: "__*",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_BOLD],
    match: "__**",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_BOLD, MARK_ITALIC],
    match: "___***",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: MARK_BOLD,
    match: "**",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: MARK_UNDERLINE,
    match: "__",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: MARK_ITALIC,
    match: "*",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: MARK_ITALIC,
    match: "_",
    query: notInCodeBlock,
  },
  {
    mode: "mark",
    type: MARK_STRIKETHROUGH,
    match: "~~",
    query: notInCodeBlock,
  },
  // I haven't set these up yet
  // {
  //   mode: "mark",
  //   type: MARK_SUPERSCRIPT,
  //   match: "^",
  // },
  // {
  //   mode: "mark",
  //   type: MARK_SUBSCRIPT,
  //   match: "~",
  // },
  // {
  //   mode: "mark",
  //   type: MARK_HIGHLIGHT,
  //   match: "==",
  // },
  // {
  //   mode: "mark",
  //   type: MARK_HIGHLIGHT,
  //   match: "≡",
  // },
  // {
  //   mode: "block",
  //   type: ELEMENT_TODO_LI,
  //   match: "[] ",
  // },
  // {
  //   mode: "block",
  //   type: ELEMENT_TODO_LI,
  //   match: "[x] ",
  //   format: (editor) =>
  //     setNodes<TTodoListItemElement>(
  //       editor,
  //       { type: ELEMENT_TODO_LI, checked: true },
  //       {
  //         match: (n) => isBlock(editor, n),
  //       },
  //     ),
  // },
  // {
  //   mode: "block",
  //   type: ELEMENT_HR,
  //   match: ["---", "—-", "___ "],
  //   format: (editor) => {
  //     setNodes(editor, { type: ELEMENT_HR });
  //     insertNodes(editor, {
  //       type: ELEMENT_DEFAULT,
  //       children: [{ text: "" }],
  //     });
  //   },
  // },
];
