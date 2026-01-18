import { createPlatePlugin } from "platejs/react";
import { ELEMENT_VIDEO } from "../../../plate-types";

/**
 * Supports the video element.
 *
 * NOTE: Used to handle video upload prior to unifying in createMediaPlugin; I think this plugin
 * is still necessary for the video element to work.
 */
export const createVideoPlugin = createPlatePlugin({
  key: ELEMENT_VIDEO,
  // https://docs.slatejs.org/concepts/02-nodes
  node: {
    isElement: true,
    isVoid: true,
  },
});
