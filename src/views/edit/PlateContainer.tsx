import { withProps } from "@udecode/cn";
import {
  Plate,
  PlateElement,
  PlateLeaf,
  RenderAfterEditable,
  createHistoryPlugin,
  createPlugins,
  createReactPlugin,
  isBlockAboveEmpty,
  isSelectionAtBlockStart,
} from "@udecode/plate-common";
import { observer } from "mobx-react-lite";
import React from "react";
// import { Node as SNode } from "slate";
import * as SlateCustom from "../../markdown/remark-slate-transformer/transformers/mdast-to-slate";

import {
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE, // inside code_block, not inline code (that's mark_code)
  ELEMENT_CODE_SYNTAX,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_H4,
  ELEMENT_H5,
  ELEMENT_H6,
  ELEMENT_IMAGE,
  ELEMENT_LI,
  ELEMENT_LINK,
  ELEMENT_MEDIA_EMBED,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_TD,
  ELEMENT_TODO_LI,
  ELEMENT_UL,
  // elements
  KEYS_HEADING,
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_SUBSCRIPT,
  MARK_SUPERSCRIPT,
  MARK_UNDERLINE,
  // @udecode/plate-autoformat
  createAutoformatPlugin,
  createBasicElementsPlugin,
  createBasicMarksPlugin,
  createExitBreakPlugin,
  createFilePlugin,
  createImagePlugin,
  createIndentListPlugin,
  createIndentPlugin,
  // links
  createLinkPlugin,
  createListPlugin,
  // images
  // https://platejs.org/docs/media
  createSelectOnBackspacePlugin,
  createSoftBreakPlugin,
  // createTogglePlugin
  // So document always has a trailing paragraph, ensures you
  // can always type after the last non-paragraph block.
  createTrailingBlockPlugin,
  createVideoPlugin,
  isCodeBlockEmpty,
  isSelectionAtCodeBlockStart,
  // imported for resetNodePlugin
  unwrapCodeBlock,
} from "@udecode/plate";

import {
  BlockquoteElement,
  CodeBlockElement,
  CodeLeaf,
  CodeLineElement,
  CodeSyntaxLeaf,
  HeadingElement,
  ImageElement,
  LinkElement,
  LinkFloatingToolbar,
  ListElement,
  ParagraphElement,
  VideoElement,
} from "./editor/elements";

import {
  ELEMENT_NOTE_LINK,
  NOTE_LINK,
  NoteLinkDropdownElement,
  NoteLinkElement,
  createNoteLinkDropdownPlugin,
  createNoteLinkElementPlugin,
} from "./editor/features/note-linking";
import { autoformatRules } from "./editor/plugins/autoformat/autoformatRules";
import { createCodeBlockNormalizationPlugin } from "./editor/plugins/createCodeBlockNormalizationPlugin";
import { createInlineEscapePlugin } from "./editor/plugins/createInlineEscapePlugin";
import { createResetNodePlugin } from "./editor/plugins/createResetNodePlugin";

import { ELEMENT_VIDEO } from "./editor/plugins/createVideoPlugin";

import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { SearchStore } from "../documents/SearchStore";
import { createImageGalleryPlugin } from "./editor/features/images";
import {
  ELEMENT_IMAGE_GALLERY,
  ImageGalleryElement,
} from "./editor/features/images/ImageGalleryElement";
import { createMediaUploadPlugin } from "./editor/features/images/createMediaUploadPlugin";
import { createNormalizeImagesPlugin } from "./editor/features/images/createNormalizeImagesPlugin";

export interface Props {
  saving: boolean;
  value: SlateCustom.SlateNode[];
  setValue: (n: SlateCustom.SlateNode[]) => any;
}

export default observer(
  ({ children, value, setValue }: React.PropsWithChildren<Props>) => {
    const jstore = useJournals();
    const client = useClient();
    const store = new SearchStore(client, jstore!, () => {}, []);

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

        // The new createMediaUploadPlugin supercedes this one; leave for
        // deserialization and embed handling? Or integrate into media plugin...
        // NOTE: The image, file, video plugins are needed to tell Plate to use the
        // corresponding element. The upload / insert behavior is defined in
        // createMediaUploadPlugin()
        createImagePlugin({
          options: {
            uploadImage: client.files.uploadImage,
          },
        }),
        createVideoPlugin(),
        createFilePlugin(),
        createNormalizeImagesPlugin(),
        createMediaUploadPlugin(),

        // Plate's media handler turns youtube links, twitter links, etc, into embeds.
        // I'm unsure how to trigger the logic, probably via toolbar or shortcut.
        // createMediaEmbedPlugin(),

        createNoteLinkDropdownPlugin({ options: { store } } as any),
        createNoteLinkElementPlugin(),
        createImageGalleryPlugin(),

        // Backspacing into an element selects the block before deleting it.
        createSelectOnBackspacePlugin({
          options: {
            query: {
              allow: [
                ELEMENT_IMAGE,
                ELEMENT_IMAGE_GALLERY,
                ELEMENT_MEDIA_EMBED,
              ],
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

        // When editing "inline" elements, allow space at the end to "escape" from the element.
        // ex: link or note link editing.
        // See plugin comments for links and details; this is
        createInlineEscapePlugin(),

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

        // convert markdown to wysiwyg as you type:
        // # -> h1, ``` -> code block, etc
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
          [ELEMENT_H1]: withProps(HeadingElement, { variant: "h1" }),
          [ELEMENT_H2]: withProps(HeadingElement, { variant: "h2" }),
          [ELEMENT_H3]: withProps(HeadingElement, { variant: "h3" }),
          [ELEMENT_H4]: withProps(HeadingElement, { variant: "h4" }),
          [ELEMENT_H5]: withProps(HeadingElement, { variant: "h5" }),
          [ELEMENT_H6]: withProps(HeadingElement, { variant: "h6" }),
          [ELEMENT_IMAGE]: ImageElement,
          [ELEMENT_IMAGE_GALLERY]: ImageGalleryElement,
          [ELEMENT_LINK]: LinkElement,

          // NoteLinkDropdown provides the dropdown when typing `@`; NoteLinkElement
          // is the actual element that gets inserted when you select a note.
          [NOTE_LINK]: NoteLinkDropdownElement,
          [ELEMENT_NOTE_LINK]: NoteLinkElement,

          [ELEMENT_UL]: withProps(ListElement, { variant: "ul" }),
          [ELEMENT_LI]: withProps(PlateElement, { as: "li" }),
          [ELEMENT_OL]: withProps(ListElement, { variant: "ol" }),
          [ELEMENT_PARAGRAPH]: ParagraphElement,
          [MARK_BOLD]: withProps(PlateLeaf, { as: "strong" }),
          [MARK_ITALIC]: withProps(PlateLeaf, { as: "em" }),
          [MARK_STRIKETHROUGH]: withProps(PlateLeaf, { as: "s" }),
          [MARK_SUBSCRIPT]: withProps(PlateLeaf, { as: "sub" }),
          [MARK_SUPERSCRIPT]: withProps(PlateLeaf, { as: "sup" }),
          [MARK_UNDERLINE]: withProps(PlateLeaf, { as: "u" }),
        },
      },
    );

    return (
      <Plate initialValue={value as any} onChange={setValue} plugins={plugins}>
        {children}
      </Plate>
    );
  },
);
