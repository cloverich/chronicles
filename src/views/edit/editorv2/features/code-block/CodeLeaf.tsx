import * as React from "react";

import type { PlateLeafProps } from "platejs/react";

import { PlateLeaf } from "platejs/react";

export function CodeLeaf(props: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      as="code"
      className="bg-muted rounded-md px-[0.3em] py-[0.2em] font-mono text-[length:calc(var(--font-size-body)*0.875)] whitespace-pre-wrap"
    >
      {props.children}
    </PlateLeaf>
  );
}
