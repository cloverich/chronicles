import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { withProps, withVariants } from "@udecode/cn";
import { cva } from "class-variance-authority";

const separatorVariants = cva("shrink-0 bg-border", {
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-full w-px",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

// Added along with @radix-ui/react-separator to support the Plate Toolbar
// https://platejs.org/docs/components/separator
// https://www.radix-ui.com/primitives/docs/components/separator
export const Separator = withVariants(
  withProps(SeparatorPrimitive.Root, {
    orientation: "horizontal",
    decorative: true,
  }),
  separatorVariants,
);
