import React from "react";
import { cn, withRef } from "@udecode/cn";
import { useElement, PlateElement } from "@udecode/plate-common";
import { TLinkElement, useLink } from "@udecode/plate-link";

export const LinkElement = withRef<typeof PlateElement>(
  ({ className, children, ...props }, ref) => {
    const element = useElement<TLinkElement>();
    const { props: linkProps } = useLink({ element });

    return (
      <PlateElement
        ref={ref}
        asChild
        className={cn(
          "text-primary cursor-pointer underline underline-offset-1 decoration-1",
          className,
        )}
        {...(linkProps as any)}
        {...props}
      >
        <a>{children}</a>
      </PlateElement>
    );
  },
);
