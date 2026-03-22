import fs from "fs";
import path from "path";
import sharp from "sharp";

import { createId } from "../preload/client/util";

export type UploadImageWarningCode =
  | "decode_missing_plugin"
  | "decode_failed"
  | "process_failed";

export interface UploadImageWarning {
  code: UploadImageWarningCode;
  message: string;
}

export interface UploadImageResult {
  url: string;
  warning?: UploadImageWarning;
}

function getSharpWarning(error: unknown): UploadImageWarning {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("no decoding plugin installed") ||
    normalized.includes("heif") ||
    normalized.includes("heic") ||
    normalized.includes("libheif")
  ) {
    return { code: "decode_missing_plugin", message };
  }

  if (normalized.includes("bad seek") || normalized.includes("unsupported")) {
    return { code: "decode_failed", message };
  }

  return { code: "process_failed", message };
}

/**
 * Minimal folder-management interface used by JournalsClient.
 * Node.js-compatible replacement for the electron-store-backed FilesClient.
 */
export interface IJournalFolderOps {
  createFolder(name: string): Promise<void>;
  renameFolder(oldName: string, newName: string): Promise<void>;
  removeFolder(name: string): Promise<void>;
}

export class NodeFilesClient implements IJournalFolderOps {
  constructor(private notesDir: string) {}

  createFolder = async (name: string): Promise<void> => {
    const newPath = path.join(this.notesDir, name);
    await fs.promises.mkdir(newPath, { recursive: true });
  };

  renameFolder = async (oldName: string, newName: string): Promise<void> => {
    const oldPath = path.join(this.notesDir, oldName);
    const newPath = path.join(this.notesDir, newName);
    await fs.promises.rename(oldPath, newPath);
  };

  removeFolder = async (name: string): Promise<void> => {
    const folderPath = path.join(this.notesDir, name);
    await fs.promises.rm(folderPath, { recursive: true, force: true });
  };

  /**
   * Ensure a directory exists, creating it recursively if needed.
   * @param dirPath - Absolute path to the directory
   * @param createIfMissing - If false, just validate it exists (default: true)
   */
  ensureDir = async (
    dirPath: string,
    createIfMissing = true,
  ): Promise<void> => {
    if (createIfMissing) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  };

  readDocument = async (filepath: string): Promise<string> => {
    return fs.promises.readFile(filepath, "utf8");
  };

  uploadDocument = async (
    document: { id: string; content: string },
    journal: string,
  ): Promise<string> => {
    const journalPath = path.join(this.notesDir, journal);
    const docPath = path.join(journalPath, `${document.id}.md`);

    // Guard against path traversal
    if (!path.resolve(docPath).startsWith(path.resolve(journalPath))) {
      throw new Error("Invalid path: Directory traversal attempt detected.");
    }

    await fs.promises.mkdir(journalPath, { recursive: true });
    await fs.promises.writeFile(docPath, document.content);
    return docPath;
  };

  copyFile = async (src: string, dest: string): Promise<string> => {
    await fs.promises.copyFile(src, dest);
    return dest;
  };

  deleteDocument = async (
    documentId: string,
    journal: string,
  ): Promise<void> => {
    const docPath = path.join(this.notesDir, journal, `${documentId}.md`);
    await fs.promises.unlink(docPath);
  };

  validFile = async (
    filepath: string,
    propagateErr: boolean = true,
  ): Promise<boolean> => {
    try {
      const file = await fs.promises.stat(filepath);
      if (!file.isFile()) return false;
      await fs.promises.access(filepath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (err: any) {
      if (err.code !== "ENOENT" && propagateErr) throw err;
      return false;
    }
  };

  /**
   * Upload an image from an ArrayBuffer, processing it with sharp.
   * Saves to _attachments directory under notesDir.
   */
  uploadImageBytes = async (
    arrayBuffer: ArrayBuffer,
    name = "upload.png",
  ): Promise<UploadImageResult> => {
    const dir = path.join(this.notesDir, "_attachments");
    await this.ensureDir(dir);

    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(name) || ".webp";
    const filename = `${createId()}${ext}`;
    const filepath = path.join(dir, filename);

    let warning: UploadImageWarning | undefined;

    try {
      await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(filepath);
    } catch (error) {
      warning = getSharpWarning(error);
      console.warn(
        "[NodeFilesClient] sharp failed, saving original bytes",
        (error as Error).message,
      );
      await fs.promises.writeFile(filepath, buffer);
    }

    return {
      url: `chronicles://../_attachments/${filename}`,
      warning,
    };
  };

  /**
   * Upload a generic file (video, document, etc.) from an ArrayBuffer.
   * Unlike uploadImageBytes, this does not process the file.
   */
  uploadFileBytes = async (
    arrayBuffer: ArrayBuffer,
    name = "upload.bin",
  ): Promise<string> => {
    const dir = path.join(this.notesDir, "_attachments");
    await this.ensureDir(dir);

    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(name) || ".bin";
    const filename = `${createId()}${ext}`;
    const filepath = path.join(dir, filename);

    await fs.promises.writeFile(filepath, buffer);

    return `chronicles://../_attachments/${filename}`;
  };
}
