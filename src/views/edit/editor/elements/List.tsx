import React from "react";

import { cn, withRef, withVariants } from "@udecode/cn";
import { PlateElement } from "@udecode/plate-common";
import { cva } from "class-variance-authority";

const listVariants = cva(
  cn(
    "m-0 ps-6 mb-6",
    // Second and Third level lists structure like:
    // <ul><li> Stuff.... <ul><li> Level 2 stuff...</li></ul></li></ul>
    // So remove mb from nested (parent li already has), and
    // add mt (because they are inside an li, they dont get margin from parent)
    "[&_ul]:mb-0 [&_ul]:mt-[0.35em]",
    "[&_ul_ul]:mb-0 [&_ul_ul]:mt-[0.35em]",
  ),
  {
    variants: {
      variant: {
        ol: "list-decimal",
        ul: "list-disc [&_ul]:list-[circle] [&_ul_ul]:list-[square]",
      },
    },
  },
);

const ListElementVariants = withVariants(PlateElement, listVariants, [
  "variant",
]);

export const ListElement = withRef<typeof ListElementVariants>(
  ({ children, variant = "ul", ...props }, ref) => {
    const Component = variant!;

    return (
      <ListElementVariants asChild ref={ref} variant={variant} {...props}>
        <Component>{children}</Component>
      </ListElementVariants>
    );
  },
);
