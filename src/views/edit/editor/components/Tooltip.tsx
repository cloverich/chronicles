import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { withCn, withProps } from "@udecode/cn";
import React from "react";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export const TooltipContent = withCn(
  withProps(TooltipPrimitive.Content, {
    sideOffset: 4,
  }),
  "z-50 overflow-hidden py-0.5 px-1.5 rounded-sm border bg-popover text-sm text-tooltip-foreground bg-tooltip shadow-md",
);

// Added along with @radix-ui/react-tooltip to support the Plate Toolbar
// https://www.radix-ui.com/primitives/docs/components/tooltip
// https://platejs.org/docs/components/tooltip
export function withTooltip<
  T extends React.ComponentType<any> | keyof HTMLElementTagNameMap,
>(Component: T) {
  return React.forwardRef<
    React.ElementRef<T>,
    React.ComponentPropsWithoutRef<T> & {
      tooltip?: React.ReactNode;
      tooltipContentProps?: Omit<
        React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
        "children"
      >;
      tooltipProps?: Omit<
        React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>,
        "children"
      >;
    }
  >(function ExtendComponent(
    { tooltip, tooltipContentProps, tooltipProps, ...props },
    ref,
  ) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    const component = <Component ref={ref} {...(props as any)} />;

    if (tooltip && mounted) {
      return (
        <Tooltip {...tooltipProps}>
          <TooltipTrigger asChild>{component}</TooltipTrigger>

          <TooltipPortal>
            <TooltipContent {...tooltipContentProps}>{tooltip}</TooltipContent>
          </TooltipPortal>
        </Tooltip>
      );
    }

    return component;
  });
}
