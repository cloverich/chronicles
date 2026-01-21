import React from "react";
import { useNavigate } from "react-router-dom";

import { IconButton } from "../../../components/IconButton";
import { Separator } from "../../../components/Separator";
import { JournalResponse } from "../../../hooks/useClient";
import Titlebar from "../../../titlebar/macos";
import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
import EditorErrorBoundary from "../EditorErrorBoundary";
import { EditorMode } from "../EditorMode";
import FrontMatter from "../FrontMatter";
import { EditorToolbar } from "./features/toolbar/EditorToolbar";
import { useFocusEditor } from "./useFocusEditor";

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

export const EditorLayout = ({
  document,
  journals,
  goBack,
  selectedViewMode,
  setSelectedViewMode,
  children,
}: React.PropsWithChildren<Props>) => {
  const navigate = useNavigate();
  const focusEditor = useFocusEditor();

  return (
    <EditorErrorBoundary
      documentId={document.id}
      journal={document.journal}
      navigate={navigate}
    >
      <Base.EditorContainer>
        <Titlebar>
          <IconButton
            aria-label="Back to documents"
            icon="chevron-left"
            className="drag-none mr-4"
            onClick={goBack}
          />
          <Separator orientation="vertical" />
          <EditorToolbar
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
          />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer onClick={focusEditor}>
          <div className="flex w-full grow flex-col">
            <FrontMatter document={document} journals={journals} />

            <div className="flex grow pt-6">
              {/* w-full ensures when content is empty, it has width, otherwise the cursor will be invisible */}
              {children}
            </div>

            {/* Add padding to bottom of editor without disrupting the scrollbar on the parent */}
            <Base.BottomSpacer onMouseDown={focusEditor} />
          </div>
        </Base.ScrollContainer>
      </Base.EditorContainer>
    </EditorErrorBoundary>
  );
};
