import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

import type { AttachmentStore } from "./attachments";
import {
  VIDEO_EXTENSIONS,
  findFfmpeg,
  planVideo,
  prepareImage,
  probeVideo,
  transcodeVideo,
} from "./media-policy";

/** Stored extension for a format sharp reports, for images kept as they are. */
const FORMAT_EXT: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
  avif: ".avif",
  svg: ".svg",
};

export type UploadImageWarningCode =
  "decode_missing_plugin" | "decode_failed" | "process_failed";

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
   * Upload an image from an ArrayBuffer under the shared media policy (the
   * iPhone app's Large size; see media-policy.ts): over 2048 px or heavy
   * JPEG/WebP become JPEG q80 at most 2048 px, PNG stays PNG, GIF and images
   * that already fit are stored as they are. Content-addressed by the stored
   * bytes.
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
      const prepared = await prepareImage(buffer);
      if (prepared) {
        bytes = prepared.data;
        ext = prepared.ext;
      } else {
        const format = (await sharp(buffer, { failOn: "none" }).metadata())
          .format as string | undefined;
        bytes = buffer;
        ext = (format && FORMAT_EXT[format]) || path.extname(name) || ".bin";
      }
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
   * Upload a video under the shared media policy: over 1920 px, over 30 fps,
   * or much heavier than it needs becomes H.264 MP4 (see media-policy.ts);
   * one that fits is stored as it is. Without ffmpeg, or if the transcode
   * fails, the original is stored and a warning returned.
   */
  uploadVideoBytes = async (
    arrayBuffer: ArrayBuffer,
    name = "upload.mov",
  ): Promise<UploadImageResult> => {
    const ext = (path.extname(name) || ".mov").toLowerCase();
    const work = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "chronicles-upload-"),
    );
    try {
      const src = path.join(work, `source${ext}`);
      await fs.promises.writeFile(src, Buffer.from(arrayBuffer));
      try {
        const tools = await findFfmpeg();
        const probe = await probeVideo(tools, src);
        const plan = probe && planVideo(probe);
        if (plan) {
          const out = path.join(work, "out.mp4");
          await transcodeVideo(tools, src, plan, out);
          const stored = await this.attachments.putFile(out, name);
          return { url: stored.url };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[NodeFilesClient] video kept as is:", message);
        const stored = await this.attachments.putFile(src, name);
        return {
          url: stored.url,
          warning: { code: "process_failed", message },
        };
      }
      const stored = await this.attachments.putFile(src, name);
      return { url: stored.url };
    } finally {
      await fs.promises.rm(work, { recursive: true, force: true });
    }
  };

  /** Whether `name` is a video the policy handles. */
  isVideoName = (name: string): boolean =>
    VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());

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
