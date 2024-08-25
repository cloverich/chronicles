import { createPluginFactory } from "@udecode/plate-common";

import { ELEMENT_NOTE_LINK } from "./NoteLinkElement";

export const createNoteLinkElementPlugin = createPluginFactory({
  isElement: true,
  isInline: true,
  key: ELEMENT_NOTE_LINK,
});
