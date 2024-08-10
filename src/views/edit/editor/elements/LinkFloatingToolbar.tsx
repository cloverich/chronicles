import React from "react";
import { cn } from "@udecode/cn";
import {
  flip,
  offset,
  UseVirtualFloatingOptions,
} from "@udecode/plate-floating";
import {
  FloatingLinkUrlInput,
  LinkFloatingToolbarState,
  LinkOpenButton,
  useFloatingLinkEdit,
  useFloatingLinkEditState,
  useFloatingLinkInsert,
  useFloatingLinkInsertState,
} from "@udecode/plate-link";

import { Icons } from "../.././../../components/icons";

import { buttonVariants } from "../components/Button";
import { inputVariants } from "../components/Input";
import { popoverVariants } from "../components/Popover";
import { Separator } from "../components/Separator";

const floatingOptions: UseVirtualFloatingOptions = {
  placement: "bottom-start",
  middleware: [
    offset(12),
    flip({
      padding: 12,
      fallbackPlacements: ["bottom-end", "top-start", "top-end"],
    }),
  ],
};

export interface LinkFloatingToolbarProps {
  state?: LinkFloatingToolbarState;
}

/**
 * When links are present in documents, clicking on them will show a floating toolbar
 * so you can edit or navigate to the URL; similar to Slack, Notion, etc.
 *
 * Pulled from plate
 */
export function LinkFloatingToolbar({ state }: LinkFloatingToolbarProps) {
  const insertState = useFloatingLinkInsertState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    props: insertProps,
    ref: insertRef,
    hidden,
    textInputProps,
  } = useFloatingLinkInsert(insertState);

  const editState = useFloatingLinkEditState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    props: editProps,
    ref: editRef,
    editButtonProps,
    unlinkButtonProps,
  } = useFloatingLinkEdit(editState);

  if (hidden) return null;

  const input = (
    <div className="flex w-[330px] flex-col">
      <div className="flex items-center">
        <div className="flex items-center pl-3 text-muted-foreground">
          <Icons.link className="h-4 w-4" />
        </div>

        <FloatingLinkUrlInput
          className={inputVariants({ variant: "ghost", h: "sm" })}
          placeholder="Paste link"
        />
      </div>

      <Separator />

      <div className="flex items-center">
        <div className="flex items-center pl-3 text-muted-foreground">
          <Icons.text className="h-4 w-4" />
        </div>
        <input
          className={inputVariants({ variant: "ghost", h: "sm" })}
          placeholder="Text to display"
          {...textInputProps}
        />
      </div>
    </div>
  );

  const editContent = editState.isEditing ? (
    input
  ) : (
    <div className="box-content flex h-7 items-center">
      <button
        type="button"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        {...editButtonProps}
      >
        Edit link
      </button>

      <Separator orientation="vertical" />

      <LinkOpenButton
        className={buttonVariants({
          variant: "ghost",
          size: "sms",
        })}
      >
        <Icons.externalLink width={18} />
      </LinkOpenButton>

      <Separator orientation="vertical" />

      <button
        type="button"
        className={buttonVariants({
          variant: "ghost",
          size: "sms",
        })}
        {...unlinkButtonProps}
      >
        <Icons.unlink width={18} />
      </button>
    </div>
  );

  return (
    <>
      <div
        ref={insertRef}
        className={cn(popoverVariants(), "w-auto")}
        {...insertProps}
      >
        {input}
      </div>

      <div
        ref={editRef}
        className={cn(popoverVariants(), "w-auto")}
        {...editProps}
      >
        {editContent}
      </div>
    </>
  );
}
