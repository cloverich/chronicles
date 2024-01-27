import React from "react";
import { withRef, withVariants } from "@udecode/cn";
import { PlateElement } from "@udecode/plate";
import { cva } from "class-variance-authority";

const listVariants = cva("m-0 ps-6", {
  variants: {
    variant: {
      ul: "list-disc [&_ul]:list-[circle] [&_ul_ul]:list-[square]",
      ol: "list-decimal",
    },
  },
});

const ListElementVariants = withVariants(PlateElement, listVariants, [
  "variant",
]);

// https://github.com/udecode/plate/blob/main/apps/www/src/registry/default/plate-ui/list-element.tsx
export const ListElement = withRef<typeof ListElementVariants>(
  ({ className, children, variant = "ul", ...props }, ref) => {
    const Component = variant!;

    return (
      <ListElementVariants ref={ref} asChild {...props}>
        <Component>{children}</Component>
      </ListElementVariants>
    );
  },
);
