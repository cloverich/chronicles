import { cn } from "@udecode/cn";
import { PlateLeaf, PlateLeafProps } from "@udecode/plate/react";
import React from "react";

export function CodeLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      className={cn(
        "whitespace-pre-wrap rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-sm",
        className,
      )}
      {...props}
    >
      <code spellCheck={false}>{children}</code>
    </PlateLeaf>
  );
}
