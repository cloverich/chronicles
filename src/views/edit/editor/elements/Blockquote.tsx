import { cn, withRef } from "@udecode/cn";
import { PlateElement } from "@udecode/plate-common";
import React from "react";

export const BlockquoteElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    return (
      <PlateElement
        ref={ref}
        asChild
        className={cn(
          "my-6 border-l-4 pl-6 italic text-muted-foreground",
          className,
        )}
        {...props}
      >
        <blockquote>{children}</blockquote>
      </PlateElement>
    );
  },
);
