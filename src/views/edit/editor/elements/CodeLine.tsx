import React from "react";

import { withRef } from "@udecode/cn";
import { PlateElement } from "@udecode/plate/react";

/**
 * See: CodeBlockElement, CodeLeafElement, and the mdast / slate transformations for code.
 *
 * TODO: This is a placeholder for the CodeLineElement component; it is never called by Plate even though
 * we definitely have code_line elements in our Slate document; we specifically create them in mdast-to-slate,
 * and they show up when debugging. The element is plugged into the component tree in the Plate setup, and I'm
 * out of ideas. Need to better understand how Plate plugins are called to figure this out. Until then it seems
 * to work, so maybe an internal CodeLineElement is being used by plate? It seems the CodeSyntaxLeaf is called correctly
 */
export const CodeLineElement = withRef<typeof PlateElement>((props, ref) => {
  return <PlateElement ref={ref} {...props} />;
});
