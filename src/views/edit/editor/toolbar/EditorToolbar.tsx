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
import { ToolbarGroup, FixedToolbar } from "../components/Toolbar";

// I think this needs to be on the root, wherever Theme would be added (if we had a theme)
import { TooltipProvider } from "../components/Tooltip";
import InsertBlockDropdown from "./components/InsertBlockDropdown";
import ChangeBlockDropdown from "./components/ChangeBlockDropdown";
import DebugDropdown from "./components/DebugDropdown";
import { EditorMode } from "../../EditorMode";

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
}

/**
 * The main toolbar used by the editor.
 *
 * Adapted from apps/www/src/components/plate-ui/playground-fixed-toolbar-buttons.tsx
 */
export function EditorToolbar({
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
          <>
            <FixedToolbar>
              <ToolbarGroup>
                <InsertBlockDropdown />
                <ChangeBlockDropdown />
              </ToolbarGroup>

              <ToolbarGroup>
                <MarkToolbarButton tooltip="Bold (⌘+B)" nodeType={MARK_BOLD}>
                  <Icons.bold />
                </MarkToolbarButton>
                <MarkToolbarButton
                  tooltip="Italic (⌘+I)"
                  nodeType={MARK_ITALIC}
                >
                  <Icons.italic />
                </MarkToolbarButton>
                <MarkToolbarButton
                  tooltip="Underline (⌘+U)"
                  nodeType={MARK_UNDERLINE}
                >
                  <Icons.underline />
                </MarkToolbarButton>

                <>
                  <MarkToolbarButton
                    tooltip="Strikethrough (⌘+⇧+M)"
                    nodeType={MARK_STRIKETHROUGH}
                  >
                    <Icons.strikethrough />
                  </MarkToolbarButton>
                  <MarkToolbarButton tooltip="Code (⌘+E)" nodeType={MARK_CODE}>
                    <Icons.code />
                  </MarkToolbarButton>
                </>

                {/* NOTE: id prop was removed, probably was for Playground to support multiple editors */}
              </ToolbarGroup>

              {/* <ToolbarGroup> */}
              {/* {isEnabled("indentlist", id) && indentList && (
                <>
                  <IndentListToolbarButton nodeType={ListStyleType.Disc} />
                  <IndentListToolbarButton nodeType={ListStyleType.Decimal} />
                </>
              )} */}

              {/* NOTE: id prop was removed, probably was for Playground to support multiple editors */}
              {/* <>
                <ListToolbarButton nodeType={ELEMENT_UL} />
                <ListToolbarButton nodeType={ELEMENT_OL} />
              </> */}

              <ToolbarGroup>
                <LinkToolbarButton />
              </ToolbarGroup>

              <ToolbarGroup>
                <DebugDropdown
                  selectedEditorMode={selectedEditorMode}
                  setSelectedEditorMode={setSelectedEditorMode}
                />
              </ToolbarGroup>
            </FixedToolbar>
          </>

          <div className="grow" />
        </div>
      </div>
    </TooltipProvider>
  );
}
