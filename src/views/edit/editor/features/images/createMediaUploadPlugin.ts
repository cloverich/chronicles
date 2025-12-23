import { PlateEditor, createPlatePlugin } from "@udecode/plate/react";

import { isImageUrl, isVideoUrl } from "../../../../../hooks/images";
import { ELEMENT_IMAGE, ELEMENT_LINK } from "../../plate-types";
import { ELEMENT_VIDEO } from "../../plugins/createVideoPlugin";

// Ideally this is injected
const client = window.chronicles.getClient();

/**
 * createMediaUploadPlugin handles uploading video, images, and files, before
 * creating the corresponding element(s) in the editor. Or if it doesn't know
 * what to do, it delegates to insertData so perhaps another plugin can handle it.
 *
 * Created to unify the image, video, and file handling plugins.
 */
export const createMediaUploadPlugin = createPlatePlugin({
  key: "mediaUploadPlugin",
  node: {
    isElement: false,
  },
}).overrideEditor(({ editor, tf: { insertData } }) => ({
  transforms: {
    insertData(dataTransfer: DataTransfer) {
      const text = dataTransfer.getData("text/plain");
      const { files } = dataTransfer;

      console.log(
        "[MediaUpload] insertData called, files:",
        files?.length,
        "text:",
        !!text,
      );

      // If there are files and no text, handle file uploads
      if (!text && files && files.length > 0) {
        console.log("[MediaUpload] Processing", files.length, "files");

        // Process files asynchronously
        processFiles(Array.from(files), editor).then((handled) => {
          console.log("[MediaUpload] Processed files, handled:", handled);
          // If we didn't handle all files, we could delegate,
          // but DataTransfer is consumed at this point
        });

        // Return early - we're handling it (asynchronously)
        return;
      }

      // Not files, delegate to the next plugin
      console.log("[MediaUpload] Delegating to next insertData");
      insertData(dataTransfer);
    },
  },
}));

/**
 * Process an array of files, uploading and inserting each one.
 */
async function processFiles(
  files: File[],
  editor: PlateEditor,
): Promise<number> {
  let processed = 0;

  for (const file of files) {
    console.log(
      "[MediaUpload] Processing file:",
      file.name,
      "type:",
      file.type,
    );

    let handled = false;

    // Try image first
    [handled] = await handleImage(file, editor);
    if (handled) {
      console.log("[MediaUpload] Handled as image");
      processed++;
      continue;
    }

    // Try video
    [handled] = await handleVideo(file, editor);
    if (handled) {
      console.log("[MediaUpload] Handled as video");
      processed++;
      continue;
    }

    // Try generic file
    [handled] = await handleFile(file, editor);
    if (handled) {
      console.log("[MediaUpload] Handled as file");
      processed++;
      continue;
    }

    console.log("[MediaUpload] File not handled:", file.name);
  }

  return processed;
}

const handleVideo = async (
  file: File,
  editor: PlateEditor,
): Promise<[boolean, string?]> => {
  const [mime] = file.type.split("/");
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  console.log(
    "[MediaUpload] handleVideo - file:",
    file.name,
    "mime:",
    file.type,
    "parsed mime:",
    mime,
  );
  if (mime !== "video") {
    console.log("[MediaUpload] handleVideo - not a video mime type");
    return [false];
  }

  // The slate-mdast parser / serializer relies on a whitelist of
  // extensions to parse and serialize the video element correctly.
  if (!isVideoUrl(file.name)) {
    console.error("Unsupported video extension:", extension);
    return [false];
  }

  // Read file as ArrayBuffer and upload (file.path is not available in Plate context)
  const buffer = await file.arrayBuffer();
  const filepath = await client.files.uploadFileBytes(buffer, file.name);

  // Use Plate's transform API instead of Slate's insertNode
  editor.tf.insertNode({
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

  // Read file as ArrayBuffer and upload (file.path is not available in Plate context)
  const buffer = await file.arrayBuffer();
  const filepath = await client.files.uploadFileBytes(buffer, file.name);

  // Extract filename from the filepath for display
  const filename = filepath.split("/").pop() || file.name;
  editor.tf.insertNode({
    type: ELEMENT_LINK,
    url: filepath,
    children: [{ text: `File: ${filename}` }],
  });

  return [true, filepath];
};

const handleImage = async (
  file: File,
  editor: PlateEditor,
): Promise<[boolean, string?]> => {
  const [mime] = file.type.split("/");
  if (mime !== "image") return [false];

  // Upload the bytes directly:
  const buffer = await file.arrayBuffer();
  const filepath = await client.files.uploadImageBytes(buffer, file.name);

  editor.tf.insertNode({
    type: ELEMENT_IMAGE,
    url: filepath,
    children: [{ text: "" }],
  });

  return [true, filepath];
};
