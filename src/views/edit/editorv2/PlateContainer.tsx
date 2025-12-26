import { Plate, PlateContent, PlateElement, PlateElementProps, usePlateEditor } from "platejs/react";
import React from "react";
import { ReactEditor } from "slate-react";
import { EditorLayout } from "./EditorLayout";
// import { useNavigate } from "react-router-dom";
// import { useFocusEditor } from "..";
// import { IconButton } from "../../../components/IconButton";
import { JournalResponse } from "../../../hooks/useClient";
// import Titlebar from "../../../titlebar/macos";
// import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
// import EditorErrorBoundary from "../EditorErrorBoundary";
import { EditorMode } from "../EditorMode";
// import FrontMatter from "./FrontMatter";
// import { Separator } from "./components/Separator";
// import { EditorToolbar } from "./toolbar/EditorToolbar";
import { H1Element, H2Element, H3Element, H4Element, H5Element } from "./features/HeadingElement";


import {
  BlockquotePlugin,
  BoldPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
  H5Plugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';

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
        borderLeft: '2px solid #eee',
        marginLeft: 0,
        marginRight: 0,
        paddingLeft: '24px',
        color: '#666',
        fontStyle: 'italic',
      }}
      {...props}
    />
  );
}

export const PlateContainer = (props: Props) => {
  const editor = usePlateEditor({
    plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin, 
      H1Plugin.withComponent(H1Element),
      H2Plugin.withComponent(H2Element),
      H3Plugin.withComponent(H3Element),
      H4Plugin.withComponent(H4Element),
      H5Plugin.withComponent(H5Element),
      BlockquotePlugin.withComponent(BlockquoteElement),],
    value: props.document.getInitialSlateContent(),
  });
  const focusEditor = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e.target === e.currentTarget && !ReactEditor.isFocused(editor as any)) {
        ReactEditor.focus(editor as any);
      }
    },
    [editor],
  );

  return (
    <Plate editor={editor}>
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
