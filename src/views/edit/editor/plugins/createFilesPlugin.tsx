import { createPluginFactory } from "@udecode/plate-common";

const ELEMENT_FILE = "file";

/**
 * Supports the file element; uploading moved to createMediaPlugin
 */
export const createFilesPlugin = createPluginFactory({
  key: ELEMENT_FILE,
  isLeaf: true,
  isVoid: true,
});
