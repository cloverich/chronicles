import { AutoformatRule } from "@udecode/plate-autoformat";
import { insertEmptyCodeBlock } from "@udecode/plate-code-block";

import {
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
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

export const autoformatRules: AutoformatRule[] = [
  {
    mode: "block",
    type: ELEMENT_H1,
    match: "# ",
    preFormat,
  },
  {
    mode: "block",
    type: ELEMENT_H2,
    match: "## ",
    preFormat,
  },
  {
    mode: "block",
    type: ELEMENT_H3,
    match: "### ",
    preFormat,
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
  },
  {
    mode: "block",
    type: ELEMENT_LI,
    match: ["* ", "- "],
    preFormat,
    format: (editor) => formatList(editor, ELEMENT_UL),
  },
  {
    mode: "block",
    type: ELEMENT_LI,
    match: ["1. ", "1) "],
    preFormat,
    format: (editor) => formatList(editor, ELEMENT_OL),
  },
  // Inline code: single backtick wrapping text like `code`
  // Must be before code block rule so it's checked first
  {
    mode: "mark",
    type: MARK_CODE,
    match: "`",
  },
  // Code block: triple backticks followed by space at start of line
  {
    mode: "block",
    type: ELEMENT_CODE_BLOCK,
    match: "``` ",
    preFormat,
    format: (editor) => {
      insertEmptyCodeBlock(editor as any, {
        defaultType: ELEMENT_PARAGRAPH,
        insertNodesOptions: { select: true },
      });
    },
  },
  {
    mode: "mark",
    type: [MARK_BOLD, MARK_ITALIC],
    match: "***",
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_ITALIC],
    match: "__*",
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_BOLD],
    match: "__**",
  },
  {
    mode: "mark",
    type: [MARK_UNDERLINE, MARK_BOLD, MARK_ITALIC],
    match: "___***",
  },
  {
    mode: "mark",
    type: MARK_BOLD,
    match: "**",
  },
  {
    mode: "mark",
    type: MARK_UNDERLINE,
    match: "__",
  },
  {
    mode: "mark",
    type: MARK_ITALIC,
    match: "*",
  },
  {
    mode: "mark",
    type: MARK_ITALIC,
    match: "_",
  },
  {
    mode: "mark",
    type: MARK_STRIKETHROUGH,
    match: "~~",
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
