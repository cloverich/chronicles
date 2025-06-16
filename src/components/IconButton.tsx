import React from "react";

import { cn } from "@udecode/cn";
import { cva, VariantProps } from "class-variance-authority";
import { Icons } from "./icons";

// NOTE: Barebones variants to get style similar to the prior IconButton, stopping
// as soon as it looked close. These should be thoroughly reviewed, and potentially
// merged with Button variants.
const variants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        ghost: "hover:bg-accent active:text-muted border border-transparent",
        // hover:border hover:border-accent-foreground
      },
      size: {
        md: "h-9 px-2 py-1",
        sm: "h-7 px-2",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "sm",
    },
  },
);

export interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  // onClick?: () => void;
  icon: keyof typeof Icons;
  // asChild?: boolean;
  // loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  (
    {
      icon,
      className,
      variant,
      size,
      // disabled,
      // loading,
      // children,
      // asChild = false,
      ...rest
    },
    ref,
  ) => {
    const Icon = Icons[icon];

    return (
      <button
        {...rest}
        ref={ref}
        // disabled={loading || disabled}
        className={cn(variants({ variant, size, className }))}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
