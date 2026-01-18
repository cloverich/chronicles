import { createPlatePlugin } from "platejs/react";
import { ELEMENT_FILE } from "../../../plate-types";

/**
 * Supports the file element; uploading moved to createMediaPlugin
 */
export const createFilesPlugin = createPlatePlugin({
  key: ELEMENT_FILE,
  node: {
    isLeaf: true,
    isVoid: true,
  },
});
