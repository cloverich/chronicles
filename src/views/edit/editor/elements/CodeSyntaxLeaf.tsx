import React from "react";

import { withRef } from "@udecode/cn";
import { PlateLeaf } from "@udecode/plate/react";

/**
 * Code syntax highlighting leaf, used by the code block. NOTE this is not
 * the same as the inline code mark (`CodeLeaf`).
 *
 * The syntax token type comes through leaf.tokenType from the code-block plugin's
 * decoration system.
 */
export const CodeSyntaxLeaf = withRef<typeof PlateLeaf>(
  ({ children, ...props }, ref) => {
    const { leaf } = props;

    // The tokenType is set by the code-block plugin's decorate function
    const tokenType = (leaf as any).tokenType as string | undefined;

    return (
      <PlateLeaf ref={ref} {...props}>
        <span
          className={tokenType ? `prism-token token ${tokenType}` : undefined}
        >
          {children}
        </span>
      </PlateLeaf>
    );
  },
);
