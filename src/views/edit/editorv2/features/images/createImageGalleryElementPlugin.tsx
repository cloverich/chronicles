import { createPlatePlugin } from "platejs/react";
import { ELEMENT_IMAGE_GALLERY } from "./ImageGalleryElement";

export const createImageGalleryPlugin = createPlatePlugin({
  key: ELEMENT_IMAGE_GALLERY,
  node: {
    isElement: true,
    isInline: false,
    isVoid: true,
  },
});
