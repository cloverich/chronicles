import { withRef, withVariants } from "@udecode/cn";
import { PlateElement } from "@udecode/plate-common";
import { cva } from "class-variance-authority";
import React from "react";

const headingVariants = cva(
  "text-left tracking-tight min-w-prose max-w-prose font-medium",
  {
    variants: {
      variant: {
        h1: "mb-[0.5em] mt-[1.6em] font-heading text-2xl",
        h2: "mb-[0.5em] mt-[1.4em] font-heading-2 text-xl",
        h3: "mb-[0.5em] mt-[1em] font-heading-3 text-lg",
        h4: "mt-[0.75em] font-heading-3 text-lg",
        h5: "mt-[0.75em] text-lg font-heading-3",
        h6: "mt-[0.75em] text-base font-heading-3",
      },
      isFirstBlock: {
        true: "mt-0",
        false: "",
      },
    },
  },
);

const HeadingElementVariants = withVariants(PlateElement, headingVariants, [
  "isFirstBlock",
  "variant",
]);

export const HeadingElement = withRef<typeof HeadingElementVariants>(
  ({ variant = "h1", isFirstBlock, children, ...props }, ref) => {
    const { element, editor } = props;

    const Element = variant!;

    return (
      <HeadingElementVariants
        ref={ref}
        asChild
        variant={variant}
        isFirstBlock={element === editor.children[0]}
        {...props}
      >
        <Element>{children}</Element>
      </HeadingElementVariants>
    );
  },
);
