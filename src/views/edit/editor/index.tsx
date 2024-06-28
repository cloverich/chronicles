import React from "react";
import { withProps } from "@udecode/cn";
import { observer } from "mobx-react-lite";
import { Node as SNode } from "slate";
import {
  Plate,
  PlateContent,
  RenderAfterEditable,
  createPlugins,
  createReactPlugin,
  createHistoryPlugin,
  isBlockAboveEmpty,
  isSelectionAtBlockStart,
  PlateLeaf,
  PlateElement,
} from "@udecode/plate-common";

import {
  createBasicElementsPlugin,
  createBasicMarksPlugin,
  createIndentListPlugin,
  createIndentPlugin,

  // @udecode/plate-autoformat
  createAutoformatPlugin,

  // imported for resetNodePlugin
  unwrapCodeBlock,
  isSelectionAtCodeBlockStart,
  isCodeBlockEmpty,

  // elements
  KEYS_HEADING,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_H4,
  ELEMENT_H5,
  ELEMENT_H6,
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE, // inside code_block, not inline code (that's mark_code)
  ELEMENT_CODE_SYNTAX,
  ELEMENT_LINK,
  ELEMENT_LI,
  ELEMENT_TD,
  ELEMENT_TODO_LI,
  ELEMENT_UL,
  ELEMENT_OL,
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_SUBSCRIPT,
  MARK_SUPERSCRIPT,
  MARK_UNDERLINE,

  // images
  // https://platejs.org/docs/media
  createSelectOnBackspacePlugin,
  ELEMENT_IMAGE,
  createImagePlugin,
  ELEMENT_MEDIA_EMBED,

  // createTogglePlugin

  // So document always has a trailing paragraph, ensures you
  // can always type after the last non-paragraph block.
  createTrailingBlockPlugin,
  ELEMENT_PARAGRAPH,

  // links
  createLinkPlugin,
  createSoftBreakPlugin,
  createExitBreakPlugin,
  createResetNodePlugin,
  createListPlugin,
} from "@udecode/plate";

import { createCaptionPlugin } from "@udecode/plate-caption";

import {
  BlockquoteElement,
  CodeBlockElement,
  CodeLeaf,
  CodeSyntaxLeaf,
  CodeLineElement,
  HeadingElement,
  ParagraphElement,
  ImageElement,
  LinkElement,
  ListElement,
  LinkFloatingToolbar,
  VideoElement,
} from "./elements";

import { autoformatRules } from "./plugins/autoformat/autoformatRules";
import { createCodeBlockNormalizationPlugin } from "./plugins/createCodeBlockNormalizationPlugin";

import { ELEMENT_VIDEO, createVideoPlugin } from "./plugins/createVideoPlugin";
import { createFilesPlugin } from "./plugins/createFilesPlugin";

// Ideally this is injected; also createVideoPlugin and createFilesPlugin do this
import { IClient } from "../../../preload/client/types";
const client: IClient = (window as any).chronicles.createClient();

import { EditorToolbar } from "./toolbar/EditorToolbar";
import { EditorMode } from "../EditorMode";

export interface Props {
  saving: boolean;
  value: SNode[];
  setValue: (n: SNode[]) => any;
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
}

export default observer(
  ({
    saving,
    value,
    setValue,
    selectedEditorMode,
    setSelectedEditorMode,
  }: Props) => {
    // todo: Commented out stuff is post-copy paste edit from plate-ui (as recommended), and should used to guide next steps.
    const plugins = createPlugins(
      [
        createCodeBlockNormalizationPlugin(),

        // editor
        createReactPlugin(), // withReact
        createHistoryPlugin(), // withHistory

        // Paragraph, blockquote, code block, heading, etcj
        // https://platejs.org/docs/basic-elements
        createBasicElementsPlugin(),

        // marks: bold, iatlic, underline, etc
        createBasicMarksPlugin(),

        createLinkPlugin({
          // Without the toolbar, links cannot be easily edited
          renderAfterEditable: LinkFloatingToolbar as RenderAfterEditable,
          options: {
            allowedSchemes: ["http", "https", "mailto", "chronicles"],
          },
        }),

        createListPlugin(),

        // https://platejs.org/docs/media
        createCaptionPlugin({
          options: { pluginKeys: [ELEMENT_IMAGE, ELEMENT_MEDIA_EMBED] },
        }),
        createImagePlugin({
          options: {
            uploadImage: client.files.uploadImage,
          },
        }),

        // Plate's media handler turns youtube links, twitter links, etc, into embeds.
        // I'm unsure how to trigger the logic, probably via toolbar or shortcut.
        // createMediaEmbedPlugin(),

        // NOTE: These plugins MUST come after createImagePlugin, otherwise createImagePlugin swallows
        // dropped video files and this won't be called.
        createVideoPlugin(),
        createFilesPlugin(),

        // Backspacing into an element selects the block before deleting it.
        createSelectOnBackspacePlugin({
          options: {
            query: {
              allow: [ELEMENT_IMAGE, ELEMENT_MEDIA_EMBED],
            },
          },
        }),

        // createTodoListPlugin(),

        // So you can shift+enter new-line inside of the specified elements
        // https://platejs.org/docs/soft-break
        createSoftBreakPlugin({
          options: {
            rules: [
              { hotkey: "shift+enter" },
              {
                hotkey: "enter",
                query: {
                  allow: [ELEMENT_CODE_BLOCK, ELEMENT_BLOCKQUOTE, ELEMENT_TD],
                },
              },
            ],
          },
        }),

        // Exit text blocks with cmd+enter
        // https://platejs.org/docs/exit-break
        createExitBreakPlugin({
          options: {
            rules: [
              {
                hotkey: "mod+enter",
              },
              {
                hotkey: "mod+shift+enter",
                before: true,
              },
              {
                hotkey: "enter",
                query: {
                  start: true,
                  end: true,
                  allow: KEYS_HEADING, // shrug emoji
                },
                relative: true,
                level: 1,
              },
            ],
          },
        }),

        // Reset block when hitting enter, e.g. to stop
        // making new todo list items, etc.
        // https://platejs.org/docs/reset-node
        createResetNodePlugin({
          options: {
            rules: [
              {
                types: [ELEMENT_BLOCKQUOTE, ELEMENT_TODO_LI],
                defaultType: ELEMENT_PARAGRAPH,
                hotkey: "Enter",
                predicate: isBlockAboveEmpty,
              },
              {
                types: [ELEMENT_BLOCKQUOTE, ELEMENT_TODO_LI],
                defaultType: ELEMENT_PARAGRAPH,
                hotkey: "Backspace",
                predicate: isSelectionAtBlockStart,
              },
              {
                types: [ELEMENT_CODE_BLOCK],
                defaultType: ELEMENT_PARAGRAPH,
                onReset: unwrapCodeBlock,
                hotkey: "Enter",
                predicate: isCodeBlockEmpty,
              },
              {
                types: [ELEMENT_CODE_BLOCK],
                defaultType: ELEMENT_PARAGRAPH,
                onReset: unwrapCodeBlock,
                hotkey: "Backspace",
                predicate: isSelectionAtCodeBlockStart,
              },
            ],
          },
        }),

        // Set text block indentation for differentiating structural
        // elements or emphasizing certain content sections.
        // https://platejs.org/docs/indent
        createIndentPlugin({
          inject: {
            props: {
              validTypes: [
                // These elements from my prior implementation; docs
                // only have paragraph and h1
                ELEMENT_PARAGRAPH,
                ELEMENT_H1,
                ELEMENT_H2,
                ELEMENT_H3,
                ELEMENT_H4,
                ELEMENT_H5,
                ELEMENT_H6,
                ELEMENT_BLOCKQUOTE,
                ELEMENT_CODE_BLOCK,
              ],
            },
          },
        }),

        createIndentListPlugin(),

        // Ensures there is always a paragraph element at the end of the document; avoids
        // document getting stuck with an image or other non-text element at the end, or
        // being confused about how to exit an e.g. code block to add more content.
        createTrailingBlockPlugin({ type: ELEMENT_PARAGRAPH }),

        // e.g. # -> h1, ``` -> code block, etc
        createAutoformatPlugin({
          options: {
            rules: autoformatRules,
            enableUndoOnDelete: true,
          },
        }),
      ],
      {
        components: {
          [ELEMENT_VIDEO]: VideoElement,
          [ELEMENT_BLOCKQUOTE]: BlockquoteElement,
          [ELEMENT_CODE_BLOCK]: CodeBlockElement,
          [ELEMENT_CODE_LINE]: CodeLineElement,
          [ELEMENT_CODE_SYNTAX]: CodeSyntaxLeaf,
          [MARK_CODE]: CodeLeaf,
          // [ELEMENT_HR]: HrElement,
          [ELEMENT_H1]: withProps(HeadingElement, { variant: "h1" }),
          [ELEMENT_H2]: withProps(HeadingElement, { variant: "h2" }),
          [ELEMENT_H3]: withProps(HeadingElement, { variant: "h3" }),
          [ELEMENT_H4]: withProps(HeadingElement, { variant: "h4" }),
          [ELEMENT_H5]: withProps(HeadingElement, { variant: "h5" }),
          [ELEMENT_H6]: withProps(HeadingElement, { variant: "h6" }),
          [ELEMENT_IMAGE]: ImageElement,
          [ELEMENT_LINK]: LinkElement,
          // todo: need more plugins to make these truly usable.
          // [ELEMENT_MEDIA_EMBED]: MediaEmbedElement,
          // [ELEMENT_MENTION]: MentionElement,
          // [ELEMENT_MENTION_INPUT]: MentionInputElement,
          [ELEMENT_UL]: withProps(ListElement, { variant: "ul" }),
          [ELEMENT_LI]: withProps(PlateElement, { as: "li" }),
          [ELEMENT_OL]: withProps(ListElement, { variant: "ol" }),
          [ELEMENT_PARAGRAPH]: ParagraphElement,
          // [ELEMENT_TABLE]: TableElement,
          // [ELEMENT_TD]: TableCellElement,
          // [ELEMENT_TH]: TableCellHeaderElement,
          // [ELEMENT_TODO_LI]: TodoListElement,
          // [ELEMENT_TR]: TableRowElement,
          // [ELEMENT_EXCALIDRAW]: ExcalidrawElement,
          [MARK_BOLD]: withProps(PlateLeaf, { as: "strong" }),

          // Unsure about these:
          // [MARK_HIGHLIGHT]: HighlightLeaf,
          [MARK_ITALIC]: withProps(PlateLeaf, { as: "em" }),
          // [MARK_KBD]: KbdLeaf,
          [MARK_STRIKETHROUGH]: withProps(PlateLeaf, { as: "s" }),
          [MARK_SUBSCRIPT]: withProps(PlateLeaf, { as: "sub" }),
          [MARK_SUPERSCRIPT]: withProps(PlateLeaf, { as: "sup" }),
          [MARK_UNDERLINE]: withProps(PlateLeaf, { as: "u" }),
          // [MARK_COMMENT]: CommentLeaf,
        },
      },
    );

    return (
      <Plate
        initialValue={value as any}
        onChange={setValue}
        plugins={plugins}
        readOnly={saving}
      >
        <EditorToolbar
          selectedEditorMode={selectedEditorMode}
          setSelectedEditorMode={setSelectedEditorMode}
        />
        <PlateContent placeholder="Type..." />
      </Plate>
    );
  },
);
