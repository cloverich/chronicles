import { cn, withRef } from "@udecode/cn";
import { PlateElement } from "@udecode/plate/react";
import React from "react";

export const BlockquoteElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    return (
      <PlateElement
        ref={ref}
        className={cn(
          "my-6 max-w-prose border-l-4 pl-6 italic text-muted-foreground",
          className,
        )}
        {...props}
      >
        <blockquote>{children}</blockquote>
      </PlateElement>
    );
  },
);
