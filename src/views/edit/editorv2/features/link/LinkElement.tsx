"use client";

import * as React from "react";

import type { TLinkElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { useLink } from "@platejs/link/react";
import { PlateElement, useElement } from "platejs/react";

import { cn } from "../../../../../lib/utils";

export function LinkElement(props: PlateElementProps<TLinkElement>) {
  const element = useElement<TLinkElement>();
  const { props: linkProps } = useLink({ element });

  return (
    <PlateElement
      {...props}
      as="a"
      className={cn(
        "text-primary decoration-primary font-medium underline underline-offset-4",
      )}
      {...(linkProps as any)}
    >
      {props.children}
    </PlateElement>
  );
}
