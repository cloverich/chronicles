import {
  Plate,
  PlateContent,
  PlateElement,
  PlateElementProps,
  usePlateEditor,
} from "platejs/react";
import React from "react";
import { ReactEditor } from "slate-react";
// import { Editor, Element as SlateElement, Node, Range, Transforms } from "slate";
import { EditorLayout } from "./EditorLayout";
// import { useNavigate } from "react-router-dom";
// import { useFocusEditor } from "..";
// import { IconButton } from "../../../components/IconButton";
import { JournalResponse } from "../../../hooks/useClient";
// import Titlebar from "../../../titlebar/macos";
// import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
// import EditorErrorBoundary from "../EditorErrorBoundary";
import { useSearchStore } from "../../documents/SearchStore";
import { EditorMode } from "../EditorMode";
// import FrontMatter from "./FrontMatter";
// import { Separator } from "./components/Separator";
// import { EditorToolbar } from "./toolbar/EditorToolbar";
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from "@platejs/code-block/react";
import { IndentPlugin } from "@platejs/indent/react";
import { all, createLowlight } from "lowlight";
import {
  H1Element,
  H2Element,
  H3Element,
  H4Element,
  H5Element,
} from "./features/HeadingElement";

// Create a lowlight instance with all languages
const lowlight = createLowlight(all);

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
import {
  BulletedListPlugin,
  ListItemPlugin,
  ListPlugin,
  NumberedListPlugin,
  TaskListPlugin,
} from "@platejs/list-classic/react";
import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from "./features/code-block/CodeBlockNode";
import { CodeLeaf } from "./features/code-block/CodeLeaf";
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
} from "./features/note-linking /index";

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      style={{
        borderLeft: "2px solid #eee",
        marginLeft: 0,
        marginRight: 0,
        paddingLeft: "24px",
        color: "#666",
        fontStyle: "italic",
      }}
      {...props}
    />
  );
}

export const PlateContainer = (props: Props) => {
  const searchStore = useSearchStore()!;
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      CodePlugin.configure({
        node: { component: CodeLeaf },
        shortcuts: { toggle: { keys: "mod+e" } },
      }),
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
      NumberedListPlugin.configure({
        node: { component: NumberedListElement },
        shortcuts: { toggle: { keys: "mod+alt+6" } },
      }),
      TaskListPlugin.configure({
        node: { component: TaskListElement },
        shortcuts: { toggle: { keys: "mod+alt+7" } },
      }),
      ListItemPlugin,
      createNoteLinkDropdownPlugin
        .configure({
          options: { store: searchStore },
        })
        .withComponent(NoteLinkDropdownElement),
      createNoteLinkElementPlugin.withComponent(NoteLinkElement),
    ],

    value: props.document.getInitialSlateContent(),
  });

  const focusEditor = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (
        e.target === e.currentTarget &&
        !ReactEditor.isFocused(editor as any)
      ) {
        ReactEditor.focus(editor as any);
      }
    },
    [editor],
  );

  return (
    <Plate editor={editor as any}>
      <EditorLayout {...props} focusEditor={focusEditor}>
        <PlateContent
          style={{ padding: "16px 64px", minHeight: "100px", width: "100%" }}
          placeholder="Type your amazing content here..."
          // todo: once we do this it overrides
          // onChange={({value}) => props.document.setSlateContent(value)}
        />
      </EditorLayout>
    </Plate>
  );
};
