import { observer } from "mobx-react-lite";
import React from "react";
import { IconButton } from "../../../components/IconButton";
import { Separator } from "../../../components/Separator";
import { JournalResponse } from "../../../hooks/useClient";
import Titlebar from "../../../titlebar/macos";
import * as Base from "../../layout";
import { EditableDocument } from "../EditableDocument";
import { EditorMode } from "../EditorMode";
import FrontMatter from "../FrontMatter";
import { Toolbar, ToolbarGroup } from "../editorv2/components/Toolbar";
import { TooltipProvider } from "../editorv2/components/Tooltip";
import DebugDropdown from "../editorv2/features/toolbar/DebugDropdown";
import { LexicalBasedEditor } from "./LexicalBasedEditor";

interface Props {
  document: EditableDocument;
  selectedViewMode: EditorMode;
  setSelectedViewMode: (mode: EditorMode) => void;
  journals: JournalResponse[];
  goBack: () => void;
}

export const EditorLayout = observer(
  ({
    document,
    selectedViewMode,
    setSelectedViewMode,
    journals,
    goBack,
  }: Props) => {
    return (
      <Base.EditorContainer>
        <Titlebar>
          <IconButton
            aria-label="Back to documents"
            icon="chevron-left"
            variant="minimal"
            className="drag-none mr-4"
            onClick={goBack}
          />
          <Separator orientation="vertical" />

          <TooltipProvider
            disableHoverableContent
            delayDuration={500}
            skipDelayDuration={0}
          >
            <div className="w-full overflow-hidden">
              <div
                className="flex flex-wrap"
                style={{ transform: "translateX(calc(-1px))" }}
              >
                <div className="grow" />
                <Toolbar>
                  <ToolbarGroup className="drag-none">
                    <DebugDropdown
                      selectedEditorMode={selectedViewMode}
                      setSelectedEditorMode={setSelectedViewMode}
                      deleteDocument={() => {}}
                    />
                  </ToolbarGroup>
                </Toolbar>
              </div>
            </div>
          </TooltipProvider>
        </Titlebar>

        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <div className="flex w-full grow flex-col items-center">
            <FrontMatter document={document} journals={journals} />

            <div className="flex w-full max-w-(--max-w-prose) grow pt-6">
              <LexicalBasedEditor
                initialMarkdown={document.getInitialContent()}
                onMarkdownChange={document.setMarkdownContent}
                documentId={document.id}
              />
            </div>

            <Base.BottomSpacer />
          </div>
        </Base.ScrollContainer>
      </Base.EditorContainer>
    );
  },
);
