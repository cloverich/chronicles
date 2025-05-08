import { createPluginFactory } from "@udecode/plate-common";

import { ELEMENT_IMAGE_GALLERY } from "./ImageGalleryElement";

export const createImageGalleryPlugin = createPluginFactory({
  isElement: true,
  isInline: false,
  isVoid: true,
  key: ELEMENT_IMAGE_GALLERY,
});
