import React from "react";
import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from "@udecode/plate-basic-marks";
// import { KEY_LIST_STYLE_TYPE, ListStyleType } from "@udecode/plate-indent-list";
// import { ELEMENT_OL, ELEMENT_UL } from "@udecode/plate-list";
// import { ELEMENT_IMAGE } from "@udecode/plate-media";
import { Icons } from "../../../../components/icons";

import { LinkToolbarButton } from "./components/LinkToolbarButton";
import { MarkToolbarButton } from "./components/MarkToolbarButton";
import { ToolbarGroup, Toolbar } from "../components/Toolbar";

// I think this needs to be on the root, wherever Theme would be added (if we had a theme)
import { TooltipProvider } from "../components/Tooltip";
import ChangeBlockDropdown from "./components/ChangeBlockDropdown";
import DebugDropdown from "./components/DebugDropdown";
import { EditorMode } from "../../EditorMode";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  LinkIcon,
  MoreIcon,
} from "evergreen-ui";
import { Underline } from "lucide-react";
import { EditableDocument } from "../../EditableDocument";
import { useIsMounted } from "../../../../hooks/useIsMounted";
import { useNavigate } from "react-router-dom";
import { useSearchStore } from "../../../documents/SearchStore";

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
          className="flex flex-wrap text-muted-foreground"
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
                <MarkToolbarButton tooltip="Bold (⌘+B)" nodeType={MARK_BOLD}>
                  <BoldIcon size={16} />
                </MarkToolbarButton>
                <MarkToolbarButton
                  tooltip="Italic (⌘+I)"
                  nodeType={MARK_ITALIC}
                >
                  <ItalicIcon size={16} />
                </MarkToolbarButton>
                <MarkToolbarButton
                  tooltip="Underline (⌘+U)"
                  nodeType={MARK_UNDERLINE}
                >
                  <UnderlineIcon size={16} />
                </MarkToolbarButton>

                <>
                  <MarkToolbarButton
                    tooltip="Strikethrough (⌘+⇧+M)"
                    nodeType={MARK_STRIKETHROUGH}
                  >
                    <StrikethroughIcon size={16} />
                  </MarkToolbarButton>
                  <MarkToolbarButton tooltip="Code (⌘+E)" nodeType={MARK_CODE}>
                    <CodeIcon size={16} />
                  </MarkToolbarButton>
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
