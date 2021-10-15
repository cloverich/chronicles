import {
  getPlatePluginTypes,
  getRenderElement,
  PlatePlugin,
  ELEMENT_IMAGE,
  getImageDeserialize,
  WithOverride,
  SPEditor,
} from "@udecode/plate";
import { ReactEditor } from "slate-react";

// todo: would be nice to inject these...
import { toaster } from "evergreen-ui";
import client from "../../../../client";

import { insertFile, isImageUrl } from "./images";

/**
 * Enables support for images.
 */
export const createImagePlugin = (): PlatePlugin => ({
  pluginKeys: ELEMENT_IMAGE,
  renderElement: getRenderElement(ELEMENT_IMAGE),
  deserialize: getImageDeserialize(),
  voidTypes: getPlatePluginTypes(ELEMENT_IMAGE),
  withOverrides: imageOverrides({}),
});

const imageOverrides =
  (opts: any): WithOverride<ReactEditor & SPEditor> =>
  (editor: any) => {
    const { insertData } = editor;

    editor.insertData = (data: DataTransfer) => {
      const text = data.getData("text/plain");
      const { files } = data;

      // Implement it for real, once image uploading is decided upon
      if (files && files.length > 0) {
        for (const file of files) {
          if (!isImageUrl(file.path)) {
            toaster.warning(
              "Only images with known image extensions may be added to notes"
            );
            return;
          }

          // this works, but the preview in network tab does not. weird.
          // todo: error as a popup, progress and intermediate state
          // todo: handle editor being unmounted, more generally move this
          // to a higher level abstraction. For now it doesn't really matter.
          client.v2.files.upload(file).then((json) => {
            // todo: This hack ensures images have a chronicles:// prefix
            // for saved documents, i insert this in the mdast->slate transform step
            // Before using plate, I simply had the Image rendering element handle this logic,
            // which I believe is the best place to do it.
            insertFile(editor, `chronicles://${json.filename}`);
          }, console.error);
        }
      } else if (isImageUrl(text)) {
        insertFile(editor, text);
      } else {
        insertData(data);
      }
    };

    return editor;
  };