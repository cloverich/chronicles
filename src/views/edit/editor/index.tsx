import { PlateContent } from "@udecode/plate-common";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useFocusEditor } from "..";
import { IconButton } from "../../../components/IconButton";
import { JournalResponse } from "../../../hooks/useClient";
import Titlebar from "../../../titlebar/macos";
import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
import EditorErrorBoundary from "../EditorErrorBoundary";
import { EditorMode } from "../EditorMode";
import PlateContainer from "../PlateContainer";
import FrontMatter from "./FrontMatter";
import { Separator } from "./components/Separator";
import { EditorToolbar } from "./toolbar/EditorToolbar";

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

const ContainerWrapper = (props: Props) => {
  return (
    <PlateContainer
      saving={props.document.saving}
      value={props.document.getInitialSlateContent()}
      setValue={props.document.setSlateContent}
    >
      <Editor {...props} />
    </PlateContainer>
  );
};

export default ContainerWrapper;

const Editor = ({
  document,
  journals,
  goBack,
  selectedViewMode,
  setSelectedViewMode,
}: React.PropsWithChildren<Props>) => {
  // NOTE: useFocusEditor Assumes wrapped in PlateContainer
  const focusEditor = useFocusEditor();
  const navigate = useNavigate();

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
            className="mr-4 drag-none"
            onClick={goBack}
          />
          <Separator orientation="vertical" />

          <EditorToolbar
            selectedEditorMode={selectedViewMode}
            setSelectedEditorMode={setSelectedViewMode}
            document={document}
          />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <div className="flex w-full flex-grow flex-col">
            <FrontMatter document={document} journals={journals} />

            <div className="flex flex-grow pt-6" onClick={focusEditor}>
              {/* w-full ensures when content is empty, it has width, otherwise the cursor will be invisible */}
              <PlateContent className="w-full" />
            </div>

            {/* Add padding to bottom of editor without disrupting the scrollbar on the parent */}
            <Base.BottomSpacer onClick={focusEditor} />
          </div>
        </Base.ScrollContainer>
      </Base.EditorContainer>
    </EditorErrorBoundary>
  );
};
