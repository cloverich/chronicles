import { cn, withRef } from "@udecode/cn";
import { TElement } from "@udecode/plate";
import { useLink } from "@udecode/plate-link/react";
import { PlateElement, useElement } from "@udecode/plate/react";
import React from "react";

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
          "cursor-pointer text-link underline decoration-1 underline-offset-1 hover:text-link-hover",
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
