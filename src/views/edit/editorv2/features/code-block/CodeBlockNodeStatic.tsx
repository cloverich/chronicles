import * as React from "react";

import type { TCodeBlockElement } from "platejs";

import {
  SlateElement,
  SlateLeaf,
  type SlateElementProps,
  type SlateLeafProps,
} from "platejs/static";

export function CodeBlockElementStatic(
  props: SlateElementProps<TCodeBlockElement>,
) {
  return (
    <SlateElement
      className="py-1 **:[.hljs-emphasis]:italic **:[.hljs-section]:font-bold **:[.hljs-strong]:font-bold"
      {...props}
    >
      <div className="bg-muted/50 relative rounded-md">
        <pre className="overflow-x-auto p-8 pr-4 font-mono text-[length:var(--font-size-code)] leading-[normal] [tab-size:2] print:break-inside-avoid">
          <code>{props.children}</code>
        </pre>
      </div>
    </SlateElement>
  );
}

export function CodeLineElementStatic(props: SlateElementProps) {
  return <SlateElement {...props} />;
}

export function CodeSyntaxLeafStatic(props: SlateLeafProps) {
  const tokenClassName = props.leaf.className as string;

  return <SlateLeaf className={tokenClassName} {...props} />;
}
