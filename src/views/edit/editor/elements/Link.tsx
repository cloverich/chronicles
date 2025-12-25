import { withRef } from "@udecode/cn";
import { TElement } from "@udecode/plate";
import { useLink } from "@udecode/plate-link/react";
import { PlateElement, useElement } from "@udecode/plate/react";
import React from "react";

import { cn } from "../../../../lib/utils";

interface LinkElement extends TElement {
  url: string;
}

export const LinkElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    const element = useElement<LinkElement>();
    const { props: linkProps } = useLink({ element });

    return (
      <PlateElement
        ref={ref}
        as="a"
        className={cn(
          "text-link hover:text-link-hover cursor-pointer underline decoration-1 underline-offset-1",
          className,
        )}
        {...(linkProps as any)}
        {...props}
      >
        {children}
      </PlateElement>
    );
  },
);
