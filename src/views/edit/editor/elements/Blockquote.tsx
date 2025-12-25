import { withRef } from "@udecode/cn";
import { PlateElement } from "@udecode/plate/react";
import React from "react";

import { cn } from "../../../../lib/utils";

export const BlockquoteElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    return (
      <PlateElement
        ref={ref}
        className={cn(
          "text-muted-foreground my-6 max-w-prose border-l-4 pl-6 italic",
          className,
        )}
        {...props}
      >
        <blockquote>{children}</blockquote>
      </PlateElement>
    );
  },
);
