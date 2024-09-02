import { cn, withRef } from "@udecode/cn";
import { PlateElement, TElement, useElement } from "@udecode/plate-common";
import React from "react";
import { useNavigate } from "react-router-dom";

export const ELEMENT_NOTE_LINK = "noteLinkElement";

export interface INoteLinkElement extends TElement {
  title: string;
  noteId: string;
  journalName: string;
}

export const NoteLinkElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    const navigate = useNavigate();
    const element = useElement<INoteLinkElement>();

    function edit(e: React.MouseEvent) {
      e.preventDefault();
      navigate(`/documents/edit/${element.noteId}`);
    }

    return (
      <PlateElement
        ref={ref}
        asChild
        className={cn(
          "cursor-pointer text-indigo-800 underline decoration-1 underline-offset-1",
          className,
        )}
        {...props}
      >
        <a onClick={edit}>{children}</a>
      </PlateElement>
    );
  },
);
