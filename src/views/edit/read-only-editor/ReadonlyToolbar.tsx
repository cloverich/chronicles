import React from "react";
import { EditorMode } from "../EditorMode";
import DebugDropdown from "../components/DebugDropdown";
import { Toolbar, ToolbarGroup } from "../components/Toolbar";
import { TooltipProvider } from "../components/Tooltip";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
  deleteDocument: () => void;
}

/**
 * For the ReadOnlyTextEditor / Debug view, where we can inspect Slate DOM, MDAST, or raw markdown.
 *
 * Could be expanded to do something smart like when markdown is rendered, it could toggle markdown
 * marks instead of HTML... but probably best to just have a separate markdown editor.
 */
export function ReadonlyToolbar({
  selectedEditorMode,
  setSelectedEditorMode,
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
