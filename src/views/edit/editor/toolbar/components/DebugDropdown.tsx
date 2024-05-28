import * as React from "react";

import { ToolbarButton } from "../../components/Toolbar";
import {
  useOpenState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Icons } from "../../../../../components/icons";
import { EditorMode } from "../../../EditorMode";

const options = Object.freeze([
  { key: EditorMode.Editor, label: "Editor" },
  { key: EditorMode.SlateDom, label: "Slate DOM" },
  { key: EditorMode.Mdast, label: "MDAST" },
  { key: EditorMode.Markdown, label: "Markdown" },
]);

interface Props {
  selectedEditorMode: EditorMode;
  setSelectedEditorMode: (s: EditorMode) => any;
}

/**
 * Basic dropdown menu for toggling between various editor modes.
 */
export default function DebugDropdown({
  selectedEditorMode,
  setSelectedEditorMode,
}: Props) {
  const openState = useOpenState();

  return (
    <DropdownMenu modal={false} {...openState}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          isDropdown
          pressed={openState.open}
          tooltip="Change editor debug mode"
        >
          <Icons.bug className="ml-1 h-4 w-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="flex max-h-[500px] min-w-0 flex-col gap-0.5 overflow-y-auto"
      >
        <DropdownMenuSeparator />
        {options.map(({ key, label }) => (
          <React.Fragment key={label}>
            <DropdownMenuItem
              className="min-w-[180px]"
              key={key}
              onSelect={() => {
                setSelectedEditorMode(key);
              }}
            >
              {label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
