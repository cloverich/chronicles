import { cva, type VariantProps } from "class-variance-authority";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import * as React from "react";

const headingVariants = cva("relative mb-1", {
  variants: {
    variant: {
      h1: "mb-[0.5em] mt-[1.6em] font-heading font-medium text-2xl",
      h2: "mb-[0.5em] mt-[1.4em] font-heading-2 font-medium text-xl",
      h3: "mb-[0.5em] mt-[1em] font-heading-3 text-lg font-medium",
      h4: "mt-[0.75em] font-heading-3 text-lg font-medium",
      h5: "mt-[0.75em] text-lg font-heading-3 font-medium",
      h6: "mt-[0.75em] text-base font-heading-3 font-medium",
    },
  },
});

export function HeadingElement({
  variant = "h1",
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) {
  return (
    <PlateElement
      as={variant!}
      className={headingVariants({ variant })}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function H1Element(props: PlateElementProps) {
  return <HeadingElement variant="h1" {...props} />;
}

export function H2Element(props: PlateElementProps) {
  return <HeadingElement variant="h2" {...props} />;
}

export function H3Element(props: PlateElementProps) {
  return <HeadingElement variant="h3" {...props} />;
}

export function H4Element(props: PlateElementProps) {
  return <HeadingElement variant="h4" {...props} />;
}

export function H5Element(props: PlateElementProps) {
  return <HeadingElement variant="h5" {...props} />;
}

export function H6Element(props: PlateElementProps) {
  return <HeadingElement variant="h6" {...props} />;
}
