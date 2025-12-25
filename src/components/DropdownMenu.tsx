import * as React from "react";
import { useCallback, useState } from "react";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  createPrimitiveElement,
  withCn,
  withProps,
  withRef,
  withVariants,
} from "@udecode/cn";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";
import { Icons } from "./icons";

/**
 * This file contains the wrapping DropdownMenu used to make the insert, toggle ("turn into"),
 * and other dropdowns in the editor toolbar.
 *
 * This file is a partial copy of the DropdownMenu.tsx file from the Plate UI package.
 * The plate version builds off of the radix-ui version, adding mostly styles.
 * plate/apps/www/src/registry/default/plate-ui/dropdown-menu.tsx
 *
 * Future work should fully customize this styling to our purposes -- i.e. we likely
 * continue using the radix-ui dropdown menu, but re-do this file in its entirety.
 */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuSubTrigger = withRef<
  typeof DropdownMenuPrimitive.SubTrigger,
  {
    inset?: boolean;
  }
>(({ children, className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    className={cn(
      "focus:bg-accent data-[state=open]:bg-accent flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      inset && "pl-8",
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <Icons.chevronRight className="ml-auto size-4" />
  </DropdownMenuPrimitive.SubTrigger>
));

export const DropdownMenuSubContent = withCn(
  DropdownMenuPrimitive.SubContent,
  "z-50 min-w-32 overflow-hidden border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

const DropdownMenuContentVariants = withProps(DropdownMenuPrimitive.Content, {
  className: cn(
    "z-50 max-h-52 overflow-y-auto overflow-x-hidden min-w-32 border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  ),
  sideOffset: 4,
});

export const DropdownMenuContent = withRef<
  typeof DropdownMenuPrimitive.Content
>(({ ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuContentVariants ref={ref} {...props} />
  </DropdownMenuPrimitive.Portal>
));

const menuItemVariants = cva(
  cn(
    "relative flex h-9 cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-hidden transition-colors",
    "focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
  ),
  {
    variants: {
      inset: {
        true: "pl-8",
      },
    },
  },
);

export const DropdownMenuItem = withVariants(
  DropdownMenuPrimitive.Item,
  menuItemVariants,
  ["inset"],
);

export const DropdownMenuCheckboxItem = withRef<
  typeof DropdownMenuPrimitive.CheckboxItem
>(({ children, className, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex items-center py-1.5 pr-2 pl-8 text-sm outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50",
      "cursor-pointer",
      className,
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Icons.check className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));

export const DropdownMenuRadioItem = withRef<
  typeof DropdownMenuPrimitive.RadioItem,
  {
    hideIcon?: boolean;
  }
>(({ children, className, hideIcon, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex items-center pr-2 pl-8 text-sm outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50",
      "data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground h-9 cursor-pointer px-2",
      className,
    )}
    ref={ref}
    {...props}
  >
    {!hideIcon && (
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Icons.check className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    )}
    {children}
  </DropdownMenuPrimitive.RadioItem>
));

const dropdownMenuLabelVariants = cva(
  cn("select-none px-2 py-1.5 text-sm font-semibold"),
  {
    variants: {
      inset: {
        true: "pl-8",
      },
    },
  },
);

export const DropdownMenuLabel = withVariants(
  DropdownMenuPrimitive.Label,
  dropdownMenuLabelVariants,
  ["inset"],
);

export const DropdownMenuSeparator = withCn(
  DropdownMenuPrimitive.Separator,
  "-mx-1 my-1 h-px bg-muted",
);

export const DropdownMenuShortcut = withCn(
  createPrimitiveElement("span"),
  "ml-auto text-xs tracking-widest opacity-60",
);

export const useOpenState = () => {
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback(
    (_value = !open) => {
      setOpen(_value);
    },
    [open],
  );

  return {
    onOpenChange,
    open,
  };
};
