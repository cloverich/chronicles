import React from "react";
import { EditableDocument } from "../EditableDocument";
import { EditorMode } from "../EditorMode";
import DebugDropdown from "../components/DebugDropdown";
import { Toolbar, ToolbarGroup } from "../components/Toolbar";
import { TooltipProvider } from "../components/Tooltip";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
  document: EditableDocument;
  deleteDocument: () => void;
}

/**
 * Toolbar for the markdown editor that includes a dropdown to switch between editor modes.
 */
export function MarkdownToolbar({
  selectedEditorMode,
  setSelectedEditorMode,
  document,
  deleteDocument,
}: Props) {
  return (
    <TooltipProvider
      disableHoverableContent
      delayDuration={500}
      skipDelayDuration={0}
    >
      <div className="w-full overflow-hidden">
        <div
          className="flex flex-wrap"
          style={{
            // Conceal the first separator on each line using overflow
            transform: "translateX(calc(-1px))",
          }}
        >
          <div className="grow" />
          <>
            <Toolbar>
              <ToolbarGroup className="drag-none">
                <DebugDropdown
                  selectedEditorMode={selectedEditorMode}
                  setSelectedEditorMode={setSelectedEditorMode}
                  deleteDocument={deleteDocument}
                />
              </ToolbarGroup>
            </Toolbar>
          </>
        </div>
      </div>
    </TooltipProvider>
  );
}
