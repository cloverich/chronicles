import { withRef } from "@udecode/cn";
import { PlateElement, useElement } from "@udecode/plate/react";
import React from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "../../../../../lib/utils";
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
            "text-link hover:text-link-hover cursor-pointer underline decoration-1 underline-offset-1",
            className,
          )}
        >
          {children}
        </a>
      </PlateElement>
    );
  },
);
