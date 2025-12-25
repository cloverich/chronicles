import React from "react";
// import { KEY_LIST_STYLE_TYPE, ListStyleType } from "@udecode/plate-indent-list";
// import { ELEMENT_OL, ELEMENT_UL } from "@udecode/plate-list";
// import { ELEMENT_IMAGE } from "@udecode/plate-media";

import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from "../plate-types";

import { Toolbar, ToolbarGroup } from "../components/Toolbar";
import { LinkToolbarButton } from "./components/LinkToolbarButton";
import { MarkToolbarButton } from "./components/MarkToolbarButton";

import { useNavigate } from "react-router-dom";
import { useIsMounted } from "../../../../hooks/useIsMounted";
import { useSearchStore } from "../../../documents/SearchStore";
import { EditableDocument } from "../../EditableDocument";
import { EditorMode } from "../../EditorMode";
import { TooltipProvider } from "../components/Tooltip";
import ChangeBlockDropdown from "./components/ChangeBlockDropdown";
import DebugDropdown from "./components/DebugDropdown";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
  document: EditableDocument;
}

/**
 * The main toolbar used by the editor.
 *
 * Adapted from apps/www/src/components/plate-ui/playground-fixed-toolbar-buttons.tsx
 */
export function EditorToolbar({
  selectedEditorMode,
  setSelectedEditorMode,
  document,
}: Props) {
  const isMounted = useIsMounted();
  const navigate = useNavigate();
  const searchStore = useSearchStore()!;

  async function deleteDocument() {
    if (confirm("Are you sure?")) {
      await document.del();
      searchStore.updateSearch(document, "del");
      if (isMounted()) navigate(-1);
    }
  }

  return (
    <TooltipProvider
      disableHoverableContent
      delayDuration={500}
      skipDelayDuration={0}
    >
      <div className="w-full overflow-hidden">
        <div
          className="text-muted-foreground flex flex-wrap"
          style={{
            // Conceal the first separator on each line using overflow
            transform: "translateX(calc(-1px))",
          }}
        >
          <div className="grow" />
          <>
            <Toolbar>
              <ToolbarGroup className="drag-none">
                <ChangeBlockDropdown />
                <MarkToolbarButton
                  size="inherit"
                  tooltip="Bold (⌘+B)"
                  nodeType={MARK_BOLD}
                  icon="bold"
                />
                <MarkToolbarButton
                  tooltip="Italic (⌘+I)"
                  nodeType={MARK_ITALIC}
                  icon="italic"
                />
                <MarkToolbarButton
                  tooltip="Underline (⌘+U)"
                  nodeType={MARK_UNDERLINE}
                  icon="underline"
                />

                <>
                  <MarkToolbarButton
                    tooltip="Strikethrough (⌘+⇧+M)"
                    nodeType={MARK_STRIKETHROUGH}
                    icon="strikethrough"
                  />
                  <MarkToolbarButton
                    tooltip="Code (⌘+E)"
                    nodeType={MARK_CODE}
                    icon="code"
                  />
                </>
                <LinkToolbarButton />
              </ToolbarGroup>

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
