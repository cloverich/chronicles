import { createPluginFactory } from "@udecode/plate-common";
// Ideally this is injected
import { IClient } from "../../../../hooks/useClient";

const client: IClient = (window as any).chronicles.createClient();

export const ELEMENT_VIDEO = "video";

/**
 * Supports the video element.
 *
 * NOTE: Used to handle video upload prior to unifying in createMediaPlugin; I think this plugin
 * is still necessary for the video element to work.
 */
export const createVideoPlugin = createPluginFactory({
  key: ELEMENT_VIDEO,
  // https://docs.slatejs.org/concepts/02-nodes
  isElement: true,
  isVoid: true,
});
