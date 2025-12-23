import { createPlatePlugin } from "@udecode/plate/react";

import { ELEMENT_NOTE_LINK } from "./NoteLinkElement";

export const createNoteLinkElementPlugin = createPlatePlugin({
  key: ELEMENT_NOTE_LINK,
  node: {
    isElement: true,
    isInline: true,
  },
});
