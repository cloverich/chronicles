import React from "react";
import { EditorMode } from "../EditorMode";
import { Toolbar, ToolbarGroup } from "../editor/components/Toolbar";
import { TooltipProvider } from "../editor/components/Tooltip";
import DebugDropdown from "../editor/toolbar/components/DebugDropdown";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
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
}: Props) {
  return (
    <TooltipProvider
      disableHoverableContent
      delayDuration={500}
      skipDelayDuration={0}
    >
      {/* NOTE: Unclear why I cant use Tailwind class mb-24 here  */}
      <div className="w-full overflow-hidden" style={{ marginBottom: "48px" }}>
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
              <ToolbarGroup>
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
