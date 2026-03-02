import * as React from "react";

import type { PlateElementProps } from "platejs/react";

import {
  useTodoListElement,
  useTodoListElementState,
} from "@platejs/list-classic/react";
import { cva, type VariantProps } from "class-variance-authority";
import { PlateElement } from "platejs/react";

import { cn } from "@/src/lib/utils";

const listVariants = cva("mt-0 py-1 ps-6 max-w-[var(--max-w-prose)] w-full", {
  variants: {
    variant: {
      ol: "list-decimal",
      ul: "list-disc [&_ul]:list-[circle] [&_ul_ul]:list-[square]",
    },
    nested: {
      true: "mb-0",
      false: "mb-8",
    },
  },
  defaultVariants: {
    nested: false,
  },
});

export function ListElement({
  variant,
  ...props
}: PlateElementProps & VariantProps<typeof listVariants>) {
  const nested = props.path != null && props.path.length > 1;
  return (
    <PlateElement
      as={variant!}
      className={listVariants({ variant, nested })}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function BulletedListElement(props: PlateElementProps) {
  return <ListElement variant="ul" {...props} />;
}

export function NumberedListElement(props: PlateElementProps) {
  return <ListElement variant="ol" {...props} />;
}

export function TaskListElement(props: PlateElementProps) {
  const nested = props.path != null && props.path.length > 1;
  return (
    <PlateElement
      as="ul"
      className={cn(
        "mt-0 w-full max-w-[var(--max-w-prose)] list-none! py-1 ps-6",
        nested ? "mb-0" : "mb-8",
      )}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export function ListItemElement(props: PlateElementProps) {
  const isTaskList = "checked" in props.element;

  if (isTaskList) {
    return <TaskListItemElement {...props} />;
  }

  return <BaseListItemElement {...props} />;
}

export function BaseListItemElement(props: PlateElementProps) {
  return (
    <PlateElement as="li" {...props}>
      {props.children}
    </PlateElement>
  );
}

export function TaskListItemElement(props: PlateElementProps) {
  const { element } = props;
  const state = useTodoListElementState({ element });
  const { checkboxProps } = useTodoListElement(state);
  const [firstChild, ...otherChildren] = React.Children.toArray(props.children);

  return (
    <BaseListItemElement {...props}>
      <div
        className={cn(
          "flex items-stretch *:nth-[2]:flex-1 *:nth-[2]:focus:outline-none",
          {
            "*:nth-[2]:text-muted-foreground *:nth-[2]:line-through":
              state.checked,
          },
        )}
      >
        <div
          className="-ms-5 me-1.5 flex w-fit items-start justify-center pt-[0.275em] select-none"
          contentEditable={false}
        >
          [ ]{/* <Checkbox {...checkboxProps} /> */}
        </div>

        {firstChild}
      </div>

      {otherChildren}
    </BaseListItemElement>
  );
}
