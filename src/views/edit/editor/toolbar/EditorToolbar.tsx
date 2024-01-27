import React from "react";
import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from "@udecode/plate-basic-marks";
import { useEditorReadOnly } from "@udecode/plate";
import { MARK_BG_COLOR, MARK_COLOR } from "@udecode/plate-font";
import { KEY_LIST_STYLE_TYPE, ListStyleType } from "@udecode/plate-indent-list";
import { ELEMENT_OL, ELEMENT_UL } from "@udecode/plate-list";
import { ELEMENT_IMAGE } from "@udecode/plate-media";

// import { ValueId } from "@/config/customizer-plugins";
// import { settingsStore } from "@/components/context/settings-store";
import { Icons } from "../../../../components/icons";
// import { AlignDropdownMenu } from "@/registry/default/plate-ui/align-dropdown-menu";
// import { ColorDropdownMenu } from "@/registry/default/plate-ui/color-dropdown-menu";
// import { CommentToolbarButton } from "@/registry/default/plate-ui/comment-toolbar-button";
// import { EmojiDropdownMenu } from "@/registry/default/plate-ui/emoji-dropdown-menu";
// import { IndentListToolbarButton } from "@/registry/default/plate-ui/indent-list-toolbar-button";
// import { IndentToolbarButton } from "@/registry/default/plate-ui/indent-toolbar-button";
// import { LineHeightDropdownMenu } from "@/registry/default/plate-ui/line-height-dropdown-menu";
// import { LinkToolbarButton } from "@/registry/default/plate-ui/link-toolbar-button";
// import { ListToolbarButton } from "@/registry/default/plate-ui/list-toolbar-button";
// import { MarkToolbarButton } from "@/registry/default/plate-ui/mark-toolbar-button";
// import { MediaToolbarButton } from "@/registry/default/plate-ui/media-toolbar-button";
// import { OutdentToolbarButton } from "@/registry/default/plate-ui/outdent-toolbar-button";
// import { TableDropdownMenu } from "@/registry/default/plate-ui/table-dropdown-menu";
// import { ToolbarGroup } from "@/registry/default/plate-ui/toolbar";

import { MarkToolbarButton, LinkToolbarButton } from "./ToolbarButtons";
import { ToolbarGroup, FixedToolbar } from "../components/Toolbar";

// I think this needs to be on the root, wherever Theme would be added (if we had a theme)
import { TooltipProvider } from "../components/Tooltip";

// import { PlaygroundInsertDropdownMenu } from "./playground-insert-dropdown-menu";
// import { PlaygroundModeDropdownMenu } from "./playground-mode-dropdown-menu";
// import { PlaygroundMoreDropdownMenu } from "./playground-more-dropdown-menu";
// import { PlaygroundTurnIntoDropdownMenu } from "./playground-turn-into-dropdown-menu";

// Adapted from apps/www/src/components/plate-ui/playground-fixed-toolbar-buttons.tsx
export function EditorToolbar({ id }: { id?: any }) {
  // id: any was ValueId, idk wtf it is
  // const readOnly = useEditorReadOnly();

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
          <>
            <FixedToolbar>
              <ToolbarGroup noSeparator>
                {/* <PlaygroundInsertDropdownMenu /> */}
                {/* We do have these enabled, unsure what this does though */}
                {/* {isEnabled("basicnodes", id) && (
                <PlaygroundTurnIntoDropdownMenu />
              )} */}
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

                {/* {isEnabled("font", id) && (
                <>
                  <ColorDropdownMenu nodeType={MARK_COLOR} tooltip="Text Color">
                    <Icons.color
                      className={iconVariants({ variant: "toolbar" })}
                    />
                  </ColorDropdownMenu>
                  <ColorDropdownMenu
                    nodeType={MARK_BG_COLOR}
                    tooltip="Highlight Color"
                  >
                    <Icons.bg
                      className={iconVariants({ variant: "toolbar" })}
                    />
                  </ColorDropdownMenu>
                </>
              )} */}
              </ToolbarGroup>

              <ToolbarGroup>
                {/* {isEnabled("align", id) && <AlignDropdownMenu />}

              {isEnabled("lineheight", id) && <LineHeightDropdownMenu />}

              {isEnabled("indentlist", id) && indentList && (
                <>
                  <IndentListToolbarButton nodeType={ListStyleType.Disc} />
                  <IndentListToolbarButton nodeType={ListStyleType.Decimal} />
                </>
              )} */}

                {/* <>
                <ListToolbarButton nodeType={ELEMENT_UL} />
                <ListToolbarButton nodeType={ELEMENT_OL} />
              </> */}

                {/* {(isEnabled("indent", id) ||
                isEnabled("list", id) ||
                isEnabled("indentlist", id)) && (
                <>
                  <OutdentToolbarButton />
                  <IndentToolbarButton />
                </>
              )} */}
              </ToolbarGroup>

              <ToolbarGroup>
                <LinkToolbarButton />
                {/* 
              {isEnabled("media", id) && (
                <MediaToolbarButton nodeType={ELEMENT_IMAGE} />
              )}

              {isEnabled("table", id) && <TableDropdownMenu />}

              {isEnabled("emoji", id) && <EmojiDropdownMenu />} */}

                {/* <PlaygroundMoreDropdownMenu /> */}
              </ToolbarGroup>
            </FixedToolbar>
          </>

          <div className="grow" />

          {/* <ToolbarGroup noSeparator>
          {isEnabled('comment', id) && <CommentToolbarButton />}
          <PlaygroundModeDropdownMenu />
        </ToolbarGroup> */}
        </div>
      </div>
    </TooltipProvider>
  );
}
