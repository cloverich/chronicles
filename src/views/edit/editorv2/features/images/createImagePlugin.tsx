import { createPlatePlugin } from "platejs/react";

import { ELEMENT_IMAGE } from "../../../plate-types";

/**
 * Minimal image element plugin for editorv2.
 */
export const createImagePlugin = createPlatePlugin({
  key: ELEMENT_IMAGE,
  node: {
    isElement: true,
    isVoid: true,
  },
});
