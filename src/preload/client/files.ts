import Store from "electron-store";

import fs from "fs";
import path from "path";
import { uuidv7 } from "uuidv7";

export interface Preferences {
  DATABASE_URL: string;
  PREFERENCES_FILE: string;
}

interface UploadResponse {
  filename: string;
  // filepath: string;
}

const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico", // Icons
    "image/vnd.microsoft.icon": ".ico", // Alternate MIME for icons
    "image/heif": ".heif", // High Efficiency Image Format
    "image/heic": ".heic", // High Efficiency Image Container
    "image/avif": ".avif", // AV1 Image File Format
    "image/apng": ".apng", // Animated PNG
    "image/jp2": ".jp2", // JPEG 2000
    "image/jxr": ".jxr", // JPEG XR
    "image/psd": ".psd", // Adobe Photoshop
    // Add more MIME types and extensions as necessary
  };

  if (!mimeToExt[mimeType]) {
    console.warn(`Unknown MIME type: ${mimeType}; defaulting to .unknown`);
  }
  return mimeToExt[mimeType] || ".unknown";
};

// Convert a dataUrl back into a buffer and extension, so it can
// be saved as a file
const dataURLToBufferAndExtension = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid Data URL");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");
  const extension = getExtensionFromMimeType(mimeType);

  return { buffer, extension };
};

export type IFilesClient = FilesClient;

export class FilesClient {
  constructor(private settings: Store) {}

  // NOTE: This only recieves a data url, not a file object, because
  // plate's createImagePlugin calls readAsDataUrl on files before passing
  // result to us; left relevant notes on how to refactor that (basically re-implement)
  // the plugin
  upload = async (dataUrl: string): Promise<UploadResponse> => {
    // todo: add error handling if dir not found...
    const dir = (await this.settings.get("USER_FILES_DIR")) as string;

    const { buffer, extension } = dataURLToBufferAndExtension(dataUrl);
    const filename = `${uuidv7()}${extension}`;
    const filepath = path.join(dir, filename);

    return new Promise<UploadResponse>((resolve, reject) => {
      const stream = fs.createWriteStream(filepath);

      stream.write(buffer);
      stream.end();

      stream.on("finish", () => {
        resolve({ filename });
      });
      stream.on("error", (err) => {
        reject(err);
      });
    });
  };

  uploadFile = async (file: File): Promise<UploadResponse> => {
    const dir = await this.settings.get("USER_FILES_DIR");
    const ext = path.parse(file.name).ext;
    const filename = `${uuidv7()}${ext || ".unknown"}`;
    const filepath = path.join(dir as string, filename);
    return new Promise<UploadResponse>((res, rej) => {
      const stream = fs.createWriteStream(filepath);
      // the fs write stream is not compatible with the input stream :(
      // file.stream().pipeTo(stream);

      // Normally, .path is not available in browsers. But in electron, it is.
      const inStream = fs.createReadStream((file as any).path);
      inStream
        .pipe(stream)
        .on("close", () => res({ filename: filename }))
        .on("error", (err) => rej(err));
    });
  };
}
