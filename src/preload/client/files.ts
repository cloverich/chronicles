import Store from "electron-store";

import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import { uuidv7 } from "uuidv7";
const { readFile, writeFile, access, stat } = fs.promises;

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
    const chronRoot = (await this.settings.get("NOTES_DIR")) as string;
    const dir = path.join(chronRoot, "_attachments");

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
    const chronRoot = (await this.settings.get("NOTES_DIR")) as string;
    const dir = path.join(chronRoot, "_attachments");

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

  /**
   * The uploadImage option on plate's createImagesPlugin.
   * @param dataUrl - It receives a dataurl after users drag and drop an image onto the editor of
   *  the form: data:image/png;base64,iVBORw0KGg...
   *
   * todo: Actual signature is:  string | ArrayBuffer) => string | ArrayBuffer | Promise<string | ArrayBuffer>;
   * but calling code definitely only sends a string. See implementation notes below, and also the
   * createImagePlugin implementation
   */
  uploadImage = (dataUrl: string | ArrayBuffer) => {
    // NOTE: At time of writing, the code that calls this is in plate at
    // packages/media/src/image/withImageUpload.ts
    // It receives a FileList, iterates it to get File objects, then does two things
    // 1. if (mime === 'image')  -- so I don't need to check image type here
    // 2. It calls reader.readAsDataURL(file); so IDK why the type signature is string | ArrayBuffer
    // todo(perf): Eventually, should pull in the function and re-implement it the way I had previously,
    // reading the data as ArrayBuffer and avoiding the need to encode to base64 only to immmediately
    // decode...but for now this works, and images aren't copied and pasted into the editor that often
    return this.upload(dataUrl as string).then((json: any) => {
      // todo: ImageElement could check if image is local or remote; if local, prefix with chronicles://
      return `chronicles://../_attachments/${json.filename}`;
    }, console.error) as Promise<string>; // createImagePlugin doesn't allow Promise<void>
  };

  /**
   * Writes a document to the correct file / disk location based
   * on baseDir and journalName
   *
   * @param baseDir - Chronicles root directory
   * @param document
   * @param journalName
   */
  uploadDocument = async (
    document: { id: string; content: string },
    journal: string,
  ) => {
    const { docPath, journalPath } = this.getSafeDocumentPath(
      journal,
      document.id,
    );

    await mkdirp(journalPath);
    await fs.promises.writeFile(docPath, document.content);
  };

  deleteDocument = async (documentId: string, journal: string) => {
    const { docPath } = this.getSafeDocumentPath(journal, documentId);

    await fs.promises.unlink(docPath);
  };

  renameFolder = async (oldName: string, newName: string) => {
    const baseDir = this.settings.get("NOTES_DIR") as string;
    const oldPath = path.join(baseDir, oldName);
    const newPath = path.join(baseDir, newName);

    return await fs.promises.rename(oldPath, newPath);
  };

  createFolder = async (name: string) => {
    const baseDir = this.settings.get("NOTES_DIR") as string;
    const newPath = path.join(baseDir, name);

    return fs.promises.mkdir(newPath);
  };

  removeFolder = async (name: string) => {
    const baseDir = this.settings.get("NOTES_DIR") as string;
    const newPath = path.join(baseDir, name);

    return fs.promises.rmdir(newPath, { recursive: true });
  };

  private getSafeDocumentPath = (journal: string, documentId: string) => {
    const baseDir = this.settings.get("NOTES_DIR") as string;

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
   * Ensure directory exists and can be accessed
   *
   * WARN: Logic to handle errors when writing / reading files from directory
   * are still needed as access check may be innaccurate or could change while
   * app is running.
   */
  async ensureDir(directory: string): Promise<void> {
    try {
      const dir = await stat(directory);
      if (!dir.isDirectory()) {
        throw new Error(
          `ensureDir called but ${directory} already exists as a file`,
        );
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
      await mkdirp(directory);
    }

    // NOTE: Documentation suggests Windows may report ok here, but then choke
    // when actually writing. Better to move this logic to the actual file
    // upload handlers.
    await access(directory, fs.constants.R_OK | fs.constants.W_OK);
  }
}
