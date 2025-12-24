import { withProps } from "@udecode/cn";
import {
  ParagraphPlugin,
  Plate,
  PlateElement,
  PlateLeaf,
  usePlateEditor,
} from "@udecode/plate/react";

// Feature plugins
import { AutoformatPlugin } from "@udecode/plate-autoformat/react";
import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from "@udecode/plate-basic-marks/react";
import { BlockquotePlugin } from "@udecode/plate-block-quote/react";
import { ExitBreakPlugin, SoftBreakPlugin } from "@udecode/plate-break/react";
import {
  isCodeBlockEmpty,
  isSelectionAtCodeBlockStart,
  unwrapCodeBlock,
} from "@udecode/plate-code-block";
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from "@udecode/plate-code-block/react";
import { HEADING_KEYS } from "@udecode/plate-heading";
import { HeadingPlugin } from "@udecode/plate-heading/react";
import { IndentListPlugin } from "@udecode/plate-indent-list/react";
import { IndentPlugin } from "@udecode/plate-indent/react";
import { LinkPlugin } from "@udecode/plate-link/react";
import { ListPlugin } from "@udecode/plate-list/react";
import { ImagePlugin } from "@udecode/plate-media/react";
import { ResetNodePlugin } from "@udecode/plate-reset-node/react";
import { SelectOnBackspacePlugin } from "@udecode/plate-select";
import { TrailingBlockPlugin } from "@udecode/plate-trailing-block";
import { lowlight } from "./editor/plugins/lowlight";

import { observer } from "mobx-react-lite";
import React from "react";
import * as SlateCustom from "../../markdown/remark-slate-transformer/transformers/mdast-to-slate";

import {
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_H4,
  ELEMENT_H5,
  ELEMENT_H6,
  ELEMENT_IMAGE,
  ELEMENT_LI,
  ELEMENT_MEDIA_EMBED,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_TD,
  ELEMENT_TODO_LI,
  ELEMENT_UL,
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_SUBSCRIPT,
  MARK_SUPERSCRIPT,
  MARK_UNDERLINE,
} from "./editor/plate-types";

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

import { ELEMENT_VIDEO } from "./editor/plugins/createVideoPlugin";

import useClient from "../../hooks/useClient";
import { useIndexerStore } from "../../hooks/useIndexerStore";
import { useJournals } from "../../hooks/useJournals";
import { SearchStore } from "../documents/SearchStore";
import { createImageGalleryPlugin } from "./editor/features/images";
import {
  ELEMENT_IMAGE_GALLERY,
  ImageGalleryElement,
} from "./editor/features/images/ImageGalleryElement";
import { createMediaUploadPlugin } from "./editor/features/images/createMediaUploadPlugin";
import { createNormalizeImagesPlugin } from "./editor/features/images/createNormalizeImagesPlugin";
import { createFilesPlugin } from "./editor/plugins/createFilesPlugin";
import { createVideoPlugin } from "./editor/plugins/createVideoPlugin";

// Simple predicates for reset node plugin
const isBlockAboveEmpty = (editor: any): boolean => {
  const { selection } = editor;
  if (!selection) return false;

  const [entry] = Array.from(
    editor.nodes({
      match: (n: any) => editor.isBlock(n),
    }),
  ) as any[];

  if (!entry) return false;
  const [node] = entry;

  // Check if the block has only one empty text child
  if (node.children?.length === 1) {
    const child = node.children[0];
    if (child.text !== undefined && child.text === "") {
      return true;
    }
  }
  return false;
};

const isSelectionAtBlockStart = (editor: any): boolean => {
  const { selection } = editor;
  if (!selection) return false;

  const { Range, Point } = require("slate");
  if (!Range.isCollapsed(selection)) return false;

  const [entry] = Array.from(
    editor.nodes({
      match: (n: any) => editor.isBlock(n),
    }),
  ) as any[];

  if (!entry) return false;
  const [, path] = entry;

  const start = editor.start(path);
  return Point.equals(selection.anchor, start);
};

export interface Props {
  saving: boolean;
  value: SlateCustom.SlateNode[];
  setValue: (n: SlateCustom.SlateNode[]) => any;
}

export default observer(
  ({ children, value, setValue }: React.PropsWithChildren<Props>) => {
    const jstore = useJournals();
    const client = useClient();
    const indexerStore = useIndexerStore();
    const store = new SearchStore(client, jstore!, () => {}, [], indexerStore);

    const editor = usePlateEditor({
      plugins: [
        // Custom normalization for code blocks
        createCodeBlockNormalizationPlugin,

        // Paragraph, blockquote, code block, heading, etc
        // https://platejs.org/docs/basic-elements
        BlockquotePlugin.withComponent(BlockquoteElement),
        CodeBlockPlugin.configure({
          options: {
            lowlight,
          },
        }).withComponent(CodeBlockElement),
        CodeLinePlugin.withComponent(CodeLineElement),
        CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
        HeadingPlugin.configure({
          options: {
            levels: 6,
          },
        }),
        ParagraphPlugin.withComponent(ParagraphElement),

        // marks: bold, italic, underline, etc
        BoldPlugin,
        ItalicPlugin,
        UnderlinePlugin,
        StrikethroughPlugin,
        SubscriptPlugin,
        SuperscriptPlugin,
        // Inline code mark - mod+e (cmd+e on macOS)
        CodePlugin.configure({
          shortcuts: {
            toggle: { keys: "mod+e" },
          },
        }),

        // Links
        LinkPlugin.configure({
          render: {
            afterEditable: () => <LinkFloatingToolbar />,
          },
          options: {
            allowedSchemes: ["http", "https", "mailto", "chronicles"],
          },
        }).withComponent(LinkElement),

        // Lists
        ListPlugin,

        // Media plugins
        ImagePlugin.configure({
          options: {
            uploadImage: client.files.uploadImage as any,
          },
        }).withComponent(ImageElement),
        createVideoPlugin.withComponent(VideoElement),
        createFilesPlugin,
        createNormalizeImagesPlugin,
        createMediaUploadPlugin,

        // Note linking
        createNoteLinkDropdownPlugin.configure({
          options: { store },
        }),
        createNoteLinkElementPlugin,
        createImageGalleryPlugin,

        // Backspacing into an element selects the block before deleting it
        SelectOnBackspacePlugin.configure({
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

        // So you can shift+enter new-line inside of the specified elements
        // https://platejs.org/docs/soft-break
        SoftBreakPlugin.configure({
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
        ExitBreakPlugin.configure({
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
                  allow: Object.values(HEADING_KEYS),
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
        ResetNodePlugin.configure({
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
                onReset: unwrapCodeBlock as any,
                hotkey: "Enter",
                predicate: isCodeBlockEmpty as any,
              },
              {
                types: [ELEMENT_CODE_BLOCK],
                defaultType: ELEMENT_PARAGRAPH,
                onReset: unwrapCodeBlock as any,
                hotkey: "Backspace",
                predicate: isSelectionAtCodeBlockStart as any,
              },
            ],
          },
        }),

        // When editing "inline" elements, allow space at the end to "escape" from the element
        createInlineEscapePlugin,

        // Set text block indentation
        // https://platejs.org/docs/indent
        IndentPlugin.configure({
          inject: {
            targetPlugins: [
              ParagraphPlugin.key,
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
        }),

        IndentListPlugin,

        // Ensures there is always a paragraph element at the end of the document
        TrailingBlockPlugin.configure({
          options: { type: ELEMENT_PARAGRAPH },
        }),

        // convert markdown to wysiwyg as you type
        AutoformatPlugin.configure({
          options: {
            rules: autoformatRules as any,
            enableUndoOnDelete: true,
          },
        }),
      ],
      override: {
        components: {
          [ELEMENT_VIDEO]: VideoElement,
          [ELEMENT_H1]: withProps(HeadingElement, { variant: "h1" }),
          [ELEMENT_H2]: withProps(HeadingElement, { variant: "h2" }),
          [ELEMENT_H3]: withProps(HeadingElement, { variant: "h3" }),
          [ELEMENT_H4]: withProps(HeadingElement, { variant: "h4" }),
          [ELEMENT_H5]: withProps(HeadingElement, { variant: "h5" }),
          [ELEMENT_H6]: withProps(HeadingElement, { variant: "h6" }),
          [ELEMENT_IMAGE_GALLERY]: ImageGalleryElement,
          [NOTE_LINK]: NoteLinkDropdownElement,
          [ELEMENT_NOTE_LINK]: NoteLinkElement,
          [ELEMENT_UL]: withProps(ListElement, { variant: "ul" }),
          [ELEMENT_LI]: withProps(PlateElement, { as: "li" }),
          [ELEMENT_OL]: withProps(ListElement, { variant: "ol" }),
          [MARK_BOLD]: withProps(PlateLeaf, { as: "strong" }),
          [MARK_ITALIC]: withProps(PlateLeaf, { as: "em" }),
          [MARK_STRIKETHROUGH]: withProps(PlateLeaf, { as: "s" }),
          [MARK_SUBSCRIPT]: withProps(PlateLeaf, { as: "sub" }),
          [MARK_SUPERSCRIPT]: withProps(PlateLeaf, { as: "sup" }),
          [MARK_UNDERLINE]: withProps(PlateLeaf, { as: "u" }),
          [MARK_CODE]: CodeLeaf,
        },
      },
      value: value as any,
    });

    return (
      <Plate editor={editor} onChange={({ value }) => setValue(value as any)}>
        {children}
      </Plate>
    );
  },
);
