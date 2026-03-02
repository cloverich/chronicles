import { PlateElement, PlateElementProps } from "platejs/react";
import React from "react";

export const BlockquoteElement = (props: PlateElementProps) => {
  return (
    <PlateElement
      as="blockquote"
      className="text-muted-foreground mt-0 mb-8 w-full max-w-[var(--max-w-prose)] border-l-4 pl-6 italic"
      {...props}
    />
  );
};

BlockquoteElement.displayName = "BlockQuoteElement";
