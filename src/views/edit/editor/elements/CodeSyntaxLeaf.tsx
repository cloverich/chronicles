import React from "react";

import { withRef } from "@udecode/cn";
import { useCodeSyntaxLeaf } from "@udecode/plate-code-block";
import { PlateLeaf } from "@udecode/plate-common";

/**
 * Code syntax highlighting leaf, used by the code block. NOTE this is not
 * the same as the inline code mark (`CodeLeaf`).
 */
export const CodeSyntaxLeaf = withRef<typeof PlateLeaf>(
  ({ children, ...props }, ref) => {
    const { leaf } = props;

    const { tokenProps } = useCodeSyntaxLeaf({ leaf });

    return (
      <PlateLeaf ref={ref} {...props}>
        <span {...tokenProps}>{children}</span>
      </PlateLeaf>
    );
  },
);
