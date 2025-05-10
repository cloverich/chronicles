import {
  PlateEditor,
  WithPlatePlugin,
  createPluginFactory,
  insertNode,
} from "@udecode/plate-common";

import { ELEMENT_IMAGE, ELEMENT_LINK } from "@udecode/plate";
import { ELEMENT_VIDEO } from "./createVideoPlugin";
// Ideally this is injected
import { isImageUrl, isVideoUrl } from "../../../../hooks/images";
import { IClient } from "../../../../hooks/useClient";

const client: IClient = (window as any).chronicles.createClient();

/**
 * createMediaUploadPlugin handles uploading video, images, and files, before
 * creating the corresponding element(s) in the editor. Or if it doesn't know
 * what to do, it delegates to insertData so perhaps another plugin can handle it.
 *
 * Created to unify the image, video, and file handling plugins.
 */
export const createMediaUploadPlugin = createPluginFactory({
  key: "mediaUploadPlugin",
  // https://docs.slatejs.org/concepts/02-nodes
  isElement: false,

  withOverrides: (editor: PlateEditor, _: WithPlatePlugin) => {
    // store reference to original insertData function; so we can delegate
    // if we do not handle the data ourselves
    const insertData = editor.insertData;

    // override insertData function to handle video files
    editor.insertData = async (dataTransfer: DataTransfer) => {
      const text = dataTransfer.getData("text/plain");
      const { files } = dataTransfer;
      let processed = 0;
      let expected = 0;

      // note: !text copied from createImagePlugin; I'm unsure if it's necessary.
      if (!text && files && files.length > 0) {
        expected = files.length;

        for (const file of files) {
          let handled = false;
          [handled] = await handleImage(file, editor);
          if (handled) {
            processed++;
            continue;
          }

          [handled] = await handleVideo(file, editor);
          if (handled) {
            processed++;
            continue;
          }

          [handled] = await handleFile(file, editor);
          if (handled) {
            processed++;
            continue;
          }
        }

        // handled all files
        if (expected === processed) return;
      }

      // If it's not a file, or unhandled, delegate to the next plugin.
      if (processed > 0) {
        // edge case: Unclear when we'd handle only some but not all. There's no easy way to modify or re-create
        // dataTransfer objects to pass only a sub-set down; if we pass the full thing, the remaining plugins will
        // (re)upload the ones already processed. If this happens in practice make note here.
        console.warn(
          "Handled",
          processed,
          "of",
          expected,
          "not delegating remainder",
        );
        return;
      }

      insertData(dataTransfer);
    };

    return editor;
  },
});

const handleVideo = async (
  file: File,
  editor: PlateEditor,
): Promise<[boolean, string?]> => {
  const [mime] = file.type.split("/");
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  if (mime !== "video") return [false];

  // The slate-mdast parser / serializer relies on a whitelist of
  // extensions to parse and serialize the video element correctly.
  if (!isVideoUrl(file.name)) {
    console.error("Unsupported video extension:", extension);
    return [false];
  }

  const json = await client.files.uploadFile(file);
  const filepath = `chronicles://../_attachments/${json.filename}`;

  // todo: Find a way to tie this type to the video element
  insertNode(editor, {
    type: ELEMENT_VIDEO,
    url: filepath,
    children: [{ text: "" }],
  });

  return [true, filepath];
};

const handleFile = async (
  file: File,
  editor: PlateEditor,
): Promise<[boolean, string?]> => {
  // Treat anything not image / video as a file
  if (isImageUrl(file.name) || isVideoUrl(file.name)) {
    // If it's not a file, delegate to the next plugin.
    return [false];
  }

  const json = await client.files.uploadFile(file);
  const filepath = `chronicles://../_attachments/${json.filename}`;

  insertNode(editor, {
    type: ELEMENT_LINK,
    url: filepath,
    children: [{ text: `File: ${json.filename}` }],
  });

  return [true, filepath];
};

const handleImage = async (
  file: File,
  editor: PlateEditor,
): Promise<[boolean, string?]> => {
  const [mime] = file.type.split("/");
  if (mime !== "image") return [false];

  // NOTE: The older implementation would first load the image as base64; this is
  // useful if we want to display a preview of the image before processing / upload
  // but otherwise slower.
  // const reader = new FileReader();
  // reader.addEventListener("load", async () => {
  //   if (!reader.result) {
  //     return;
  //   }

  //   const uploadedUrl = uploadImage
  //     ? await uploadImage(reader.result)
  //     : reader.result;

  //   insertImage(editor, uploadedUrl);
  // });
  // reader.readAsDataURL(file);

  // Instead, upload the bytes directly:
  const buffer = await file.arrayBuffer();
  const filepath = await client.files.uploadImageBytes(buffer, file.name);

  insertNode(editor, {
    type: ELEMENT_IMAGE,
    url: filepath,
    children: [{ text: "" }],
  });

  return [true, filepath];
};
