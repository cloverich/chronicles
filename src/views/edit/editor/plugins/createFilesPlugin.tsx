import { createPlatePlugin } from "@udecode/plate/react";

const ELEMENT_FILE = "file";

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
