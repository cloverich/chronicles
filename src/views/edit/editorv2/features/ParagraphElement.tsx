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
      className={cn("min-w-prose mt-px mb-4 max-w-prose px-0", className)}
    >
      {props.children}
    </PlateElement>
  );
};

ParagraphElement.displayName = "ParagraphElement";
