import fs from "fs";
import path from "path";
import sharp from "sharp";

import type { AttachmentStore } from "./attachments";

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

export class NodeFilesClient {
  constructor(
    private notesDir: string,
    readonly attachments: AttachmentStore,
  ) {}

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

  copyFile = async (src: string, dest: string): Promise<string> => {
    await fs.promises.copyFile(src, dest);
    return dest;
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
   * Upload an image from an ArrayBuffer, processing it with sharp (rotate,
   * resize, webp). Stored content-addressed by the processed bytes.
   */
  uploadImageBytes = async (
    arrayBuffer: ArrayBuffer,
    name = "upload.png",
  ): Promise<UploadImageResult> => {
    const buffer = Buffer.from(arrayBuffer);
    let warning: UploadImageWarning | undefined;
    let bytes: Buffer;
    let ext: string;

    try {
      bytes = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();
      ext = ".webp";
    } catch (error) {
      warning = getSharpWarning(error);
      console.warn(
        "[NodeFilesClient] sharp failed, saving original bytes",
        (error as Error).message,
      );
      bytes = buffer;
      ext = path.extname(name) || ".bin";
    }

    const stored = await this.attachments.putBytes(bytes, {
      ext,
      originalName: name,
    });
    return { url: stored.url, warning };
  };

  /**
   * Upload a generic file (video, document, etc.) from an ArrayBuffer.
   * Unlike uploadImageBytes, this does not process the file.
   */
  uploadFileBytes = async (
    arrayBuffer: ArrayBuffer,
    name = "upload.bin",
  ): Promise<string> => {
    const stored = await this.attachments.putBytes(Buffer.from(arrayBuffer), {
      ext: path.extname(name) || ".bin",
      originalName: name,
    });
    return stored.url;
  };
}
