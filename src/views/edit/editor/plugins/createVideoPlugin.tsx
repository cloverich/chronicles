import {
  PlateEditor,
  WithPlatePlugin,
  createPluginFactory,
  insertNode,
} from "@udecode/plate";
import { isVideoUrl } from "../../../../hooks/images";
// Ideally this is injected
import { IClient } from "../../../../hooks/useClient";

const client: IClient = (window as any).chronicles.createClient();

export const ELEMENT_VIDEO = "video";

/**
 * createVideoPlugin handles copying drag and dropped video files, then injecting
 * a video element with a reference to its copied url.
 */
export const createVideoPlugin = createPluginFactory({
  key: ELEMENT_VIDEO,

  // https://docs.slatejs.org/concepts/02-nodes
  isElement: true,

  // Means: This element is not editable.
  isVoid: true,

  withOverrides: (editor: PlateEditor, _: WithPlatePlugin) => {
    // store reference to original insertData function; we'll call it later
    const insertData = editor.insertData;

    // override insertData function to handle video files
    editor.insertData = (dataTransfer: DataTransfer) => {
      const text = dataTransfer.getData("text/plain");
      const { files } = dataTransfer;

      // note: !text copied from createImagePlugin; I'm unsure if it's necessary.
      if (!text && files && files.length > 0) {
        for (const file of files) {
          const [mime] = file.type.split("/");
          const extension = (file.name.split(".").pop() || "").toLowerCase();

          if (mime == "video") {
            // The slate-mdast parser / serializer relies on a whitelist of
            // extensions to parse and serialize the video element correctly.
            if (!isVideoUrl(file.name)) {
              console.error("Unsupported video extension:", extension);
              continue;
            }

            client.files.uploadFile(file).then((json: any) => {
              // TODO: The structure of the inserted node follows that of Image nodes. Slate / Plate have a
              // schema somewhere (normalization?), and deviating from it here results in SILENT FAILURE.
              // Figure out the proper place to document and type valid nodes; discovering this behavior
              // was hell.
              insertNode(editor, {
                type: ELEMENT_VIDEO,
                url: `chronicles://${json.filename}`,
                children: [{ text: "" }],
              });
            });
          } else {
            // If it's not a video, delegate to the next plugin.
            insertData(dataTransfer);
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
