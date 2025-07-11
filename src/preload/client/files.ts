import Store from "electron-store";

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { Files } from "../files";
const { readFile, writeFile, access, stat } = fs.promises;

import { IPreferences } from "../../electron/settings";
import { createId } from "./util";

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
  constructor(private settings: Store<IPreferences>) {}

  /**
   * Upload a file dropped onto the editor.
   *
   * @returns the chronicles prefixed filename
   */
  uploadImageBytes = async (arrayBuffer: ArrayBuffer, name = "upload.png") => {
    const chronRoot = (await this.settings.get("notesDir")) as string;
    const dir = path.join(chronRoot, "_attachments");
    await this.ensureDir(dir);

    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(name) || ".webp";
    const filename = `${createId()}${ext}`;
    const filepath = path.join(dir, filename);

    await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(filepath);

    return `chronicles://../_attachments/${filename}`;
  };

  /**
   * The uploadImage option on plate's createImagesPlugin.
   * @param dataUrl - It receives a dataurl after users drag and drop an image onto the editor of
   *  the form: data:image/png;base64,iVBORw0KGg...
   *
   * todo: Actual signature is:  string | ArrayBuffer) => string | ArrayBuffer | Promise<string | ArrayBuffer>;
   * but calling code definitely only sends a string. See implementation notes below, and also the
   * plate's createImagePlugin implementation
   *
   * @deprecated - Prefer uploadImageBytes until we have a use for base64 (preview)
   */
  uploadImage = async (dataUrl: string | ArrayBuffer) => {
    // NOTE: At time of writing, the code that calls this is in plate at
    // packages/media/src/image/withImageUpload.ts
    // It receives a FileList, iterates it to get File objects, then does two things
    // 1. if (mime === 'image')  -- so I don't need to check image type here
    // 2. It calls reader.readAsDataURL(file); (type should be just string, not string | ArrayBuffer)
    // todo(perf): Can re-write  withArrayBuffer and avoiding the need to encode to base64 only to immmediately
    // decode. Or, use the base64 version to display image immediately, while this routine
    // "uploads" it to the attachments dir. Lastly, could also put an empty placeholder to avoid the base64,
    // still give upload progress feedback to user, while overall improving performance.
    const chronRoot = (await this.settings.get("notesDir")) as string;
    const dir = path.join(chronRoot, "_attachments");
    await this.ensureDir(dir);

    const { buffer, extension } = dataURLToBufferAndExtension(
      dataUrl as string,
    );
    const filename = `${createId()}${extension}`;
    const filepath = path.join(dir, filename);

    return (
      sharp(buffer)
        // handle orientation
        .rotate()
        // todo: make configurable via settings, and eventually per journal
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(filepath)
        .then(() => {
          return `chronicles://../_attachments/${filename}`;
        })
        .catch((err) => {
          console.error("Error uploading or resizing file...", err);
          throw err;
        })
    );
  };

  uploadFile = async (file: File): Promise<UploadResponse> => {
    const chronRoot = (await this.settings.get("notesDir")) as string;
    const dir = path.join(chronRoot, "_attachments");

    const ext = path.parse(file.name).ext;
    const filename = `${createId()}${ext || ".unknown"}`;
    const filepath = path.join(dir, filename);
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

  /**
   * Writes a document to the correct file / disk location based
   * on baseDir and journalName
   *
   * @param baseDir - Chronicles root directory
   * @param document
   * @param journalName
   * @returns - The path to the saved document
   */
  uploadDocument = async (
    document: { id: string; content: string },
    journal: string,
  ) => {
    const { docPath, journalPath } = this.getSafeDocumentPath(
      journal,
      document.id,
    );

    await Files.mkdirp(journalPath);
    await fs.promises.writeFile(docPath, document.content);
    return docPath;
  };

  deleteDocument = async (documentId: string, journal: string) => {
    const { docPath } = this.getSafeDocumentPath(journal, documentId);

    await fs.promises.unlink(docPath);
  };

  renameFolder = async (oldName: string, newName: string) => {
    const baseDir = this.settings.get("notesDir") as string;
    const oldPath = path.join(baseDir, oldName);
    const newPath = path.join(baseDir, newName);

    return await fs.promises.rename(oldPath, newPath);
  };

  createFolder = async (name: string) => {
    const baseDir = this.settings.get("notesDir") as string;
    const newPath = path.join(baseDir, name);
    await Files.mkdirp(newPath);
  };

  removeFolder = async (name: string) => {
    const baseDir = this.settings.get("notesDir") as string;
    const newPath = path.join(baseDir, name);

    return fs.promises.rmdir(newPath, { recursive: true });
  };

  private getSafeDocumentPath = (journal: string, documentId: string) => {
    const baseDir = this.settings.get("notesDir") as string;

    const journalPath = path.join(baseDir, journal);
    const docPath = path.join(journalPath, `${documentId}.md`);

    const resolvedDocPath = path.resolve(docPath);
    const resolvedJournalPath = path.resolve(journalPath);

    if (!resolvedDocPath.startsWith(resolvedJournalPath)) {
      throw new Error("Invalid path: Directory traversal attempt detected.");
    }

    return { docPath: resolvedDocPath, journalPath: resolvedJournalPath };
  };

  /**
   * Check if a filepath exists and can be accessed; useful for confirming
   * imported / updated links are valid.
   *
   * @param filepath
   */
  validFile = async (
    filepath: string,
    propagateErr: boolean = true,
  ): Promise<boolean> => {
    try {
      const file = await stat(filepath);
      if (!file.isFile()) {
        throw new Error(
          `ensureFile called but ${filepath} already exists as a directory`,
        );
      }
    } catch (err: any) {
      if (err.code !== "ENOENT" && propagateErr) throw err;
      console.error("validFile error", err);
      return false;
    }

    // todo: idk if this is how the API is supposed to be used
    try {
      await access(filepath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (err: any) {
      if (err.code !== "ENOENT" && propagateErr) throw err;
      console.error("validFile error", err);
      return false;
    }
  };

  /**
   * Ensure directory exists and can be accessed
   *
   * WARN: Logic to handle errors when writing / reading files from directory
   * are still needed as access check may be innaccurate or could change while
   * app is running.
   */
  ensureDir = async (directory: string, create = true): Promise<void> => {
    try {
      const dir = await stat(directory);
      if (!dir.isDirectory()) {
        throw new Error(
          `ensureDir called but ${directory} already exists as a file`,
        );
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      if (create) await Files.mkdirp(directory);
    }

    // NOTE: Documentation suggests Windows may report ok here, but then choke
    // when actually writing. Better to move this logic to the actual file
    // upload handlers.
    await access(directory, fs.constants.R_OK | fs.constants.W_OK);
  };

  copyFile = async (src: string, dest: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      fs.createReadStream(src)
        .once("error", reject)
        .pipe(
          fs
            .createWriteStream(dest)
            .once("error", reject)
            .once("close", () => resolve(dest)),
        );
    });
  };
}
