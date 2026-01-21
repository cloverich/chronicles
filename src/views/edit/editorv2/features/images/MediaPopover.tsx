import { useEditorRef, useElement } from "platejs/react";
import React from "react";
import { Range } from "slate";
import { useReadOnly, useSelected } from "slate-react";

import { Button } from "../../../../../components/Button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../../../components/Popover";
import { Separator } from "../../../../../components/Separator";
import { Icons } from "../../../../../components/icons";
import { inputVariants } from "../../components/Input";

export interface MediaPopoverProps {
  pluginKey?: string;
  children: React.ReactNode;
}

/**
 * Access media-related features and options through a popover.
 * https://platejs.org/docs/components/media-popover
 *
 * I added this because the Image and Media elements required it.
 */
export function MediaPopover({
  pluginKey: _pluginKey,
  children,
}: MediaPopoverProps) {
  const readOnly = useReadOnly();
  const selected = useSelected();
  const editor = useEditorRef();
  const element = useElement();

  const selectionCollapsed = editor.selection
    ? Range.isCollapsed(editor.selection)
    : false;
  const isOpen = !readOnly && selected && selectionCollapsed;
  const [isEditing, setIsEditing] = React.useState(false);
  const [url, setUrl] = React.useState((element as any)?.url ?? "");

  React.useEffect(() => {
    setUrl((element as any)?.url ?? "");
  }, [(element as any)?.url]);

  if (readOnly) return <>{children}</>;

  const updateUrl = () => {
    try {
      const path = editor.api.findPath(element);
      if (!path) return;
      editor.tf.setNodes(
        {
          url: url.trim(),
        },
        { at: path },
      );
      setIsEditing(false);
    } catch (_error) {
      // If the node disappeared, just bail quietly.
    }
  };

  return (
    <Popover open={isOpen} modal={false}>
      <PopoverAnchor>{children}</PopoverAnchor>

      <PopoverContent
        className="w-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isEditing ? (
          <div className="flex w-[330px] flex-col">
            <div className="flex items-center px-2">
              <div className="text-muted-foreground flex items-center px-1">
                <Icons.link className="h-4 w-4" />
              </div>

              <input
                className={inputVariants({ variant: "ghost", h: "sm" })}
                placeholder="Paste the media link..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    updateUrl();
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="box-content flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit link
            </Button>

            {/* Ah, I broke this (invisible). Fix it at some point */}
            <Separator orientation="vertical" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  const path = editor.api.findPath(element);
                  if (!path) return;
                  editor.tf.removeNodes({ at: path });
                } catch (_error) {
                  // If the node disappeared, just bail quietly.
                }
              }}
            >
              <Icons.delete className="h-4 w-4" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
