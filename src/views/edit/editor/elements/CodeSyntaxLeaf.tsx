import React from "react";

import { withRef } from "@udecode/cn";
import { PlateLeaf } from "@udecode/plate/react";

/**
 * Code syntax highlighting leaf, used by the code block. NOTE this is not
 * the same as the inline code mark (`CodeLeaf`).
 *
 * The syntax token type comes through leaf.tokenType from the code-block plugin's
 * decoration system. Lowlight/highlight.js provides token classes like:
 * - hljs-keyword, hljs-string, hljs-comment, hljs-function, etc.
 *
 * The tokenType already includes the full class name (e.g., "hljs-keyword"),
 * so we use it directly without adding a prefix.
 *
 * @see https://highlightjs.org/
 * @see src/code-theme.css for styling
 */
export const CodeSyntaxLeaf = withRef<typeof PlateLeaf>(
  ({ children, ...props }, ref) => {
    const { leaf } = props;

    // The tokenType is set by the code-block plugin's decorate function
    // It already includes the full class name from lowlight (e.g., "hljs-keyword")
    const tokenType = (leaf as any).tokenType as string | undefined;

    return (
      <PlateLeaf ref={ref} {...props}>
        <span className={tokenType}>{children}</span>
      </PlateLeaf>
    );
  },
);
