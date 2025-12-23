import { cn, withRef } from "@udecode/cn";
import { PlateElement, useElement } from "@udecode/plate/react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { BaseElement } from "../../../../../markdown/remark-slate-transformer/transformers/mdast-to-slate";

export const ELEMENT_NOTE_LINK = "noteLinkElement";

export interface INoteLinkElement extends BaseElement {
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
      <PlateElement ref={ref} {...props}>
        <a
          onClick={edit}
          className={cn(
            "cursor-pointer text-link underline decoration-1 underline-offset-1 hover:text-link-hover",
            className,
          )}
        >
          {children}
        </a>
      </PlateElement>
    );
  },
);
