import {
  PlateEditor,
  WithPlatePlugin,
  createPluginFactory,
  insertNode,
} from "@udecode/plate-common";

import { ELEMENT_LINK } from "@udecode/plate";

import { isVideoUrl, isImageUrl } from "../../../../hooks/images";

// Ideally this is injected
import { IClient } from "../../../../hooks/useClient";
const client: IClient = (window as any).chronicles.createClient();

const ELEMENT_FILE = "file";

/**
 * createFilesPlugin handles copying drag and dropped (non-video, non-image) files, then injecting
 * a link element with a reference to its chronicles:// url.
 */
export const createFilesPlugin = createPluginFactory({
  key: ELEMENT_FILE,

  isLeaf: true,

  withOverrides: (editor: PlateEditor, _: WithPlatePlugin) => {
    // store reference to original insertData function; we'll call it later
    const insertData = editor.insertData;

    // override insertData function to handle files
    editor.insertData = (dataTransfer: DataTransfer) => {
      const text = dataTransfer.getData("text/plain");
      const { files } = dataTransfer;

      if (!text && files && files.length > 0) {
        for (const file of files) {
          // Treat anything not image / video as a file
          if (isImageUrl(file.name) || isVideoUrl(file.name)) {
            // If it's not a file, delegate to the next plugin.
            insertData(dataTransfer);
          } else {
            client.files.uploadFile(file).then((json: any) => {
              insertNode(editor, {
                type: ELEMENT_LINK,
                url: `chronicles://${json.filename}`,
                children: [{ text: `File: ${json.filename}` }],
              });
            });
          }
        }
      } else {
        // If it's not a file, delegate to the next plugin.
        insertData(dataTransfer);
      }
    };

    return editor;
  },
});
