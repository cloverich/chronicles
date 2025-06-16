import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { cn, withCn, withRef, withVariants } from "@udecode/cn";
import { VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { Separator } from "./Separator";
import { withTooltip } from "./Tooltip";

export const Toolbar = withCn(
  ToolbarPrimitive.Root,
  "relative flex select-none items-center gap-1",
);

export const ToolbarToggleGroup = withCn(
  ToolbarPrimitive.ToolbarToggleGroup,
  "flex items-center",
);

export const ToolbarLink = withCn(
  ToolbarPrimitive.Link,
  "font-medium underline underline-offset-4",
);

export const ToolbarSeparator = withCn(
  ToolbarPrimitive.Separator,
  "my-1 w-[1px] shrink-0 bg-border",
);

// todo: Merge these variant classes with IconButton, and / or merge IconButton and
// ToolbarButton.
const toolbarButtonVariants = cva(
  cn(
    "inline-flex items-center justify-center text-xs ring-offset-background transition-colors disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // "[&_svg:not([data-icon])]:h-5 [&_svg:not([data-icon])]:w-5",
    "rounded-sm border border-transparent",
  ),
  {
    variants: {
      variant: {
        default:
          "hover:bg-slate-50 hover:border-slate-400 hover:border hover:text-accent-foreground aria-checked:text-accent-foreground ", //border-1  border-transparent bg-transparent
        outline:
          "bg-transparent hover:bg-accent hover:text-accent-foreground hover:aria-checked:text-accent-foreground aria-checked:text-accent",
      },
      size: {
        default: "h-7 p-1.5",
        xs: "h-5 p-1.5",
        sm: "h-7 p-1.5",
        lg: "h-9 p-1.5",
        inherit: null,
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "sm",
    },
  },
);

/**
 * A styled button for the toolbar.
 */
const ToolbarButton = withTooltip(
  // eslint-disable-next-line react/display-name
  React.forwardRef<
    React.ElementRef<typeof ToolbarToggleItem>,
    Omit<
      React.ComponentPropsWithoutRef<typeof ToolbarToggleItem>,
      "asChild" | "value"
    > &
      VariantProps<typeof toolbarButtonVariants> & {
        pressed?: boolean;
        isDropdown?: boolean;
      }
  >(
    (
      { className, variant, size, isDropdown, children, pressed, ...props },
      ref,
    ) => {
      return typeof pressed === "boolean" ? (
        <ToolbarToggleGroup
          type="single"
          value="single"
          disabled={props.disabled}
        >
          <ToolbarToggleItem
            ref={ref}
            className={cn(
              toolbarButtonVariants({
                variant,
                size,
              }),
              className,
            )}
            value={pressed ? "single" : ""}
            {...props}
          >
            {children}
          </ToolbarToggleItem>
        </ToolbarToggleGroup>
      ) : (
        <ToolbarPrimitive.Button
          ref={ref}
          className={cn(
            toolbarButtonVariants({
              variant,
              size,
            }),
            isDropdown && "pr-1",
            className,
          )}
          {...props}
        >
          {children}
        </ToolbarPrimitive.Button>
      );
    },
  ),
);

ToolbarButton.displayName = "ToolbarButton";

export { ToolbarButton };

export const ToolbarToggleItem = withVariants(
  ToolbarPrimitive.ToggleItem,
  toolbarButtonVariants,
  ["variant", "size"],
);

export const ToolbarGroup = withRef<
  "div",
  {
    noSeparator?: boolean;
  }
>(({ className, children, noSeparator }, ref) => {
  const childArr = React.Children.map(children, (c) => c);
  if (!childArr || childArr.length === 0) return null;

  return (
    <div ref={ref} className={cn("flex", className)}>
      {!noSeparator && (
        <div className="h-full py-1">
          <Separator orientation="vertical" />
        </div>
      )}

      <div className="mx-1 flex items-center">{children}</div>
    </div>
  );
});
