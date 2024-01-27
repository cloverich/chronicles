import React from "react";
import {
  PlateElement,
  PlateElementProps,
  PlateLeaf,
  PlateLeafProps,
} from "@udecode/plate";

export function CodeLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf asChild className={className} {...props}>
      <code>{children}</code>
    </PlateLeaf>
  );
}
