import * as React from "react";

import { ToolbarButton } from "../../components/Toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useOpenState,
} from "./DropdownMenu";

import { MoreIcon, TrashIcon } from "evergreen-ui";

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
  deleteDocument: () => void;
}

/**
 * Basic dropdown menu for toggling between various editor modes.
 */
export default function DebugDropdown({
  selectedEditorMode,
  setSelectedEditorMode,
  deleteDocument,
}: Props) {
  const openState = useOpenState();

  return (
    <DropdownMenu modal={false} {...openState}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          isDropdown
          pressed={openState.open}
          tooltip="Change editor debug mode"
          size="xs"
        >
          <MoreIcon className="ml-1 h-4 w-4" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuLabel>Toggle debug mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          className="flex flex-col gap-0.5"
          value={selectedEditorMode}
        >
          {options.map(({ key, label }) => (
            <React.Fragment key={label}>
              <DropdownMenuRadioItem
                className="min-w-[180px]"
                key={key}
                value={key}
                onSelect={() => {
                  setSelectedEditorMode(key);
                }}
              >
                {label}
              </DropdownMenuRadioItem>
            </React.Fragment>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={deleteDocument}>
          <TrashIcon size={16} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
