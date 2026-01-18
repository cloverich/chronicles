import React from "react";
import { EditableDocument } from "../EditableDocument";
import { EditorMode } from "../EditorMode";
import { Toolbar, ToolbarGroup } from "../editorv2/components/Toolbar";
import { TooltipProvider } from "../editorv2/components/Tooltip";
import DebugDropdown from "../editorv2/features/toolbar/DebugDropdown";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
  document: EditableDocument;
}

/**
 * Toolbar for the markdown editor that includes a dropdown to switch between editor modes.
 */
export function MarkdownToolbar({
  selectedEditorMode,
  setSelectedEditorMode,
  document,
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
                  deleteDocument={() => {}}
                />
              </ToolbarGroup>
            </Toolbar>
          </>
        </div>
      </div>
    </TooltipProvider>
  );
}
