import { AutoformatPlugin, AutoformatRule } from "@platejs/autoformat";
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from "@platejs/code-block/react";
import { getDOMSelectionBoundingClientRect } from "@platejs/floating";
import { IndentPlugin } from "@platejs/indent/react";
import { all, createLowlight } from "lowlight";
import { ExitBreakPlugin, TElement, TrailingBlockPlugin } from "platejs";
import {
  ParagraphPlugin,
  Plate,
  PlateContent,
  usePlateEditor,
} from "platejs/react";
import React from "react";
import { JournalResponse } from "../../../hooks/useClient";
import { useSearchStore } from "../../documents/SearchStore";
import { EditableDocument } from "../EditableDocument";
import { EditorMode } from "../EditorMode";
import { EditorLayout } from "./EditorLayout";
import {
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
} from "./features/HeadingElement";

import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { LinkPlugin } from "@platejs/link/react";
import {
  BulletedListPlugin,
  ListItemPlugin,
  ListPlugin,
  NumberedListPlugin,
  TaskListPlugin,
} from "@platejs/list-classic/react";
import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_UL,
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
} from "../plate-types";
import { BlockquoteElement } from "./features/BlockQuoteElement";
import { ParagraphElement } from "./features/ParagraphElement";
import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from "./features/code-block/CodeBlockNode";
import { CodeLeaf } from "./features/code-block/CodeLeaf";
import { createCodeBlockNormalizationPlugin } from "./features/code-block/createCodeBlockNormalizationPlugin";
import { exitCodeBlockOnEnterPlugin } from "./features/code-block/createExitCodeBlockOnEnterPlugin";
import { ImageElement } from "./features/images/ImageElement";
import { ImageGalleryElement } from "./features/images/ImageGalleryElement";
import { VideoElement } from "./features/images/VideoElement";
import { createFilesPlugin } from "./features/images/createFilesPlugin";
import { createImageGalleryPlugin } from "./features/images/createImageGalleryElementPlugin";
import { createImagePlugin } from "./features/images/createImagePlugin";
import { createMediaUploadPlugin } from "./features/images/createMediaUploadPlugin";
import { createNormalizeImagesPlugin } from "./features/images/createNormalizeImagesPlugin";
import { createVideoPlugin } from "./features/images/createVideoPlugin";
import { LinkElement } from "./features/link/LinkElement";
import { LinkFloatingToolbar } from "./features/link/LinkToolbar";
import {
  BulletedListElement,
  NumberedListElement,
  TaskListElement,
} from "./features/list-item/ListItem";
import {
  NoteLinkDropdownElement,
  NoteLinkElement,
  createNoteLinkDropdownPlugin,
  createNoteLinkElementPlugin,
} from "./features/note-linking/index";

// Create a lowlight instance with all languages
const lowlight = createLowlight(all);

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

export const PlateContainer = (props: Props) => {
  const searchStore = useSearchStore()!;
  const editor = usePlateEditor({
    plugins: [
      createCodeBlockNormalizationPlugin,
      TrailingBlockPlugin.configure({
        options: { type: ELEMENT_PARAGRAPH },
      }),
      ExitBreakPlugin.configure({
        shortcuts: {
          insert: { keys: "mod+enter" },
          insertBefore: { keys: "mod+shift+enter" },
        },
      }),
      exitCodeBlockOnEnterPlugin,
      AutoformatPlugin.configure({
        options: {
          enableUndoOnDelete: true,
          rules: [
            // Custom block rules
            {
              match: "# ",
              mode: "block",
              type: "h1",
            },
            {
              match: "## ",
              mode: "block",
              type: "h2",
            },
            {
              match: "### ",
              mode: "block",
              type: "h3",
            },
            {
              match: "> ",
              mode: "block",
              type: "blockquote",
            },
            // Mark rules
            {
              match: "**",
              mode: "mark",
              type: MARK_BOLD,
            },
            {
              match: "_",
              mode: "mark",
              type: MARK_ITALIC,
            },
            {
              match: "~~",
              mode: "mark",
              type: MARK_STRIKETHROUGH,
            },
            {
              match: "`",
              mode: "mark",
              type: MARK_CODE,
            },
            {
              match: "```",
              mode: "block",
              type: ELEMENT_CODE_BLOCK,
            },
            {
              match: "- ",
              mode: "block",
              type: ELEMENT_UL,
            },
            {
              match: "1. ",
              mode: "block",
              type: ELEMENT_OL,
            },
            // todo: This isn't actually implemented yet
            {
              match: "[ ] ",
              mode: "block",
              type: "taskList",
            },
          ].map(
            (rule) =>
              ({
                ...rule,
                // Disable autoformat in code blocks
                query: (editor: any) =>
                  !editor.api.some({
                    match: { type: "code_block" },
                  }),
              }) as any as AutoformatRule,
          ),
        },
      }),
      BoldPlugin,
      CodePlugin.configure({
        node: { component: CodeLeaf },
        shortcuts: { toggle: { keys: "mod+e" } },
      }),
      ParagraphPlugin.withComponent(ParagraphElement),
      ItalicPlugin,
      UnderlinePlugin,
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      H4Plugin.withComponent(H4Element),
      H5Plugin.withComponent(H5Element),
      BlockquotePlugin.withComponent(BlockquoteElement),
      CodeBlockPlugin.configure({
        node: { component: CodeBlockElement },
        options: {
          lowlight,
          defaultLanguage: "ts",
        },
        shortcuts: { toggle: { keys: "mod+alt+8" } },
      }),
      CodeLinePlugin.withComponent(CodeLineElement),
      CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
      IndentPlugin,
      // ...otherPlugins,
      ListPlugin,
      BulletedListPlugin.configure({
        node: { component: BulletedListElement },
        shortcuts: { toggle: { keys: "mod+alt+5" } },
      }),
      LinkPlugin.configure({
        render: {
          afterEditable: () => (
            <LinkFloatingToolbar
              state={{
                floatingOptions: {
                  getBoundingClientRect: getDOMSelectionBoundingClientRect,
                },
              }}
            />
          ),
        },
        options: {
          allowedSchemes: ["http", "https", "mailto", "chronicles"],
        },
      }).withComponent(LinkElement),
      NumberedListPlugin.configure({
        node: { component: NumberedListElement },
        shortcuts: { toggle: { keys: "mod+alt+6" } },
      }),
      TaskListPlugin.configure({
        node: { component: TaskListElement },
        shortcuts: { toggle: { keys: "mod+alt+7" } },
      }),
      ListItemPlugin,
      createMediaUploadPlugin,
      createNormalizeImagesPlugin,
      createFilesPlugin,
      createVideoPlugin.withComponent(VideoElement),
      createImagePlugin.withComponent(ImageElement),
      createImageGalleryPlugin.withComponent(ImageGalleryElement),
      createNoteLinkDropdownPlugin
        .configure({
          options: { store: searchStore },
        })
        .withComponent(NoteLinkDropdownElement),
      createNoteLinkElementPlugin.withComponent(NoteLinkElement),
    ],

    value: props.document.getInitialSlateContent() as TElement[],
  });

  return (
    <Plate
      editor={editor as any}
      onChange={({ value }) => props.document.setSlateContent(value)}
    >
      <EditorLayout {...props}>
        <PlateContent
          className="font-body min-h-full w-full"
          placeholder="Type your amazing content here..."
        />
      </EditorLayout>
    </Plate>
  );
};
