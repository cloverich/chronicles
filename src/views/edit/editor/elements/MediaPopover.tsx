import {
  isSelectionExpanded,
  useEditorSelector,
  useElement,
  useRemoveNodeButton,
} from "@udecode/plate-common";
import React, { useEffect } from "react";

import {
  floatingMediaActions,
  FloatingMedia as FloatingMediaPrimitive,
  useFloatingMediaSelectors,
} from "@udecode/plate-media";
import { useReadOnly, useSelected } from "slate-react";

import { Icons } from "../../../../components/icons";
import { Button, buttonVariants } from "../components/Button";
import { inputVariants } from "../components/Input";
import { Popover, PopoverAnchor, PopoverContent } from "../components/Popover";
import { Separator } from "../components/Separator";

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
export function MediaPopover({ pluginKey, children }: MediaPopoverProps) {
  const readOnly = useReadOnly();
  const selected = useSelected();

  const selectionCollapsed = useEditorSelector(
    (editor) => !isSelectionExpanded(editor),
    [],
  );
  const isOpen = !readOnly && selected && selectionCollapsed;
  const isEditing = useFloatingMediaSelectors().isEditing();

  useEffect(() => {
    if (!isOpen && isEditing) {
      floatingMediaActions.isEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const element = useElement();
  const { props: buttonProps } = useRemoveNodeButton({ element });

  if (readOnly) return <>{children}</>;

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
              <div className="flex items-center px-1 text-muted-foreground">
                <Icons.link className="h-4 w-4" />
              </div>

              <FloatingMediaPrimitive.UrlInput
                className={inputVariants({ variant: "ghost", h: "sm" })}
                placeholder="Paste the embed link..."
                options={{
                  pluginKey,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="box-content flex items-center">
            <FloatingMediaPrimitive.EditButton
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Edit link
            </FloatingMediaPrimitive.EditButton>

            {/* Ah, I broke this (invisible). Fix it at some point */}
            <Separator orientation="vertical" />

            <Button variant="ghost" size="sms" {...buttonProps}>
              <Icons.delete className="h-4 w-4" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
