import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  useOpenState,
} from "../../../../../components/DropdownMenu";
import { Icons } from "../../../../../components/icons";
import { EditorMode } from "../../../EditorMode";
import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from "../../../plate-types";
import { Toolbar, ToolbarButton, ToolbarGroup } from "../../components/Toolbar";
import { TooltipProvider } from "../../components/Tooltip";
import { ChangeBlockDropdown } from "./ChangeBlockDropdown";
import { LinkToolbarButton } from "./LinkToolbarButton";
import { MarkToolbarButton } from "./MarkToolbarButton";

const options = Object.freeze([
  { key: EditorMode.Editor, label: "Editor" },
  { key: EditorMode.Markdown, label: "Markdown" },
  { key: EditorMode.SlateDom, label: "Slate DOM" },
  { key: EditorMode.Mdast, label: "MDAST" },
]);

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (mode: EditorMode) => void;
}

export function EditorToolbar({
  selectedEditorMode,
  setSelectedEditorMode,
}: Props) {
  const openState = useOpenState();

  return (
    <TooltipProvider
      disableHoverableContent
      delayDuration={500}
      skipDelayDuration={0}
    >
      <div className="w-full overflow-hidden">
        <div className="text-muted-foreground flex flex-wrap">
          <div className="grow" />
          <Toolbar>
            <ToolbarGroup className="drag-none">
              <ChangeBlockDropdown />
            </ToolbarGroup>
            <ToolbarGroup className="drag-none">
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
              <DropdownMenu modal={false} {...openState}>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton
                    isDropdown
                    pressed={openState.open}
                    tooltip="Change editor mode"
                  >
                    <Icons.more className="ml-1 h-4 w-4" />
                  </ToolbarButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-0">
                  <DropdownMenuLabel>Editor mode</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    className="flex flex-col gap-0.5"
                    value={selectedEditorMode}
                  >
                    {options.map(({ key, label }) => (
                      <DropdownMenuRadioItem
                        className="min-w-[180px]"
                        key={key}
                        value={key}
                        onSelect={() => setSelectedEditorMode(key)}
                      >
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ToolbarGroup>
          </Toolbar>
        </div>
      </div>
    </TooltipProvider>
  );
}
