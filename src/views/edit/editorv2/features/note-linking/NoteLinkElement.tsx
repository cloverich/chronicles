import { PlateElement, useElement } from "platejs/react";
import React from "react";
import { useNavigate } from "react-router-dom";

import { BaseElement } from "../../../../../markdown/remark-slate-transformer/transformers/mdast-to-slate";

export const ELEMENT_NOTE_LINK = "noteLinkElement";

export interface INoteLinkElement extends BaseElement {
  title: string;
  noteId: string;
  journalName: string;
}

export const NoteLinkElement = React.forwardRef<
  React.ElementRef<typeof PlateElement>,
  React.ComponentPropsWithoutRef<typeof PlateElement>
>(({ className, children, ...props }, ref) => {
  const navigate = useNavigate();
  const element = useElement<INoteLinkElement>();

  function edit(e: React.MouseEvent) {
    e.preventDefault();
    navigate(`/documents/edit/${element.noteId}`);
  }

  return (
    <PlateElement ref={ref} as="span" {...props}>
      <a
        onClick={edit}
        className="text-link hover:text-link-hover inline cursor-pointer underline decoration-1 underline-offset-1"
        contentEditable={false}
      >
        {element.title}
      </a>
      {/* children must be rendered for void elements but kept hidden */}
      <span style={{ display: "none" }}>{children}</span>
    </PlateElement>
  );
});

NoteLinkElement.displayName = "NoteLinkElement";
