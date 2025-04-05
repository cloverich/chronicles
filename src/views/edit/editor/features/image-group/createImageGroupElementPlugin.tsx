import { createPluginFactory } from "@udecode/plate-common";

import { ELEMENT_IMAGE_GROUP } from "./ImageGroupElement";

export const createImageGroupPlugin = createPluginFactory({
  isElement: true,
  isInline: false,
  key: ELEMENT_IMAGE_GROUP,
});
