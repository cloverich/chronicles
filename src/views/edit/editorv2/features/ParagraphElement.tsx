import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import React from "react";

import { cn } from "../../../../lib/utils";

export const ParagraphElement = ({
  className,
  ...props
}: React.PropsWithChildren<PlateElementProps>) => {
  return (
    <PlateElement
      {...props}
      className={cn(
        "mt-px mb-8 w-full max-w-[var(--max-w-prose)] px-0",
        className,
      )}
      style={{ fontSize: "var(--font-size-body)" }}
    >
      {props.children}
    </PlateElement>
  );
};

ParagraphElement.displayName = "ParagraphElement";
