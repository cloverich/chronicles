/**
 * The "Large" media policy shared with Chronicles for iPhone
 * (chronicles-apple `ImageIngest.swift`, `VideoIngest.swift`). A file that
 * already fits is left alone, so applying the policy twice changes nothing.
 *
 * - Images over 2048 px on the long edge, or JPEG/WebP over 1.5 MB, become
 *   JPEG q0.8 at ≤2048 px: upright, date and camera kept, location dropped.
 *   The original is kept when it is within 2048 px and the re-encode isn't
 *   smaller. PNG stays PNG and is only downscaled. GIF is untouched.
 * - Videos over 1920 px, over 30 fps, or over 1.3× the target bitrate become
 *   H.264 MP4 at ≤1920 px, ≤30 fps, ~0.08 bits/pixel/frame, AAC 128k, SDR.
 */
import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const IMAGE_MAX_EDGE = 2048;
export const IMAGE_QUALITY = 80;
/** JPEG and WebP files above this are re-encoded even when small in pixels. */
export const IMAGE_LARGE_BYTES = 1_500_000;

export const VIDEO_MAX_EDGE = 1920;
export const VIDEO_MAX_FPS = 30;
export const VIDEO_AUDIO_BITRATE = 128_000;
export const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".m4v"]);

/** About 0.08 bits per pixel per frame at 30 fps, never below 1 Mbps. */
export function videoBitrate(width: number, height: number): number {
  return Math.max(1_000_000, Math.round(width * height * 30 * 0.08));
}

// ---------- images ----------

export interface PreparedImage {
  data: Buffer;
  /** With the dot: `.jpg`. */
  ext: string;
}

/** Stored extension for a format sharp reports, for images kept as they are. */
export const IMAGE_FORMAT_EXT: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  gif: ".gif",
  avif: ".avif",
  svg: ".svg",
};

/** Formats re-encoded to JPEG whatever their size (readers can't show them). */
const CONVERTED = new Set(["heif", "tiff"]);

/**
 * The bytes to store for an image under the Large policy, or null when the
 * image already fits (or isn't one this policy touches).
 */
export async function prepareImage(
  bytes: Buffer,
): Promise<PreparedImage | null> {
  const meta = await sharp(bytes, { failOn: "none" }).metadata();
  const format = meta.format as string | undefined;
  if (!format || format === "gif") return null;
  // Animated WebP would lose its animation as JPEG.
  if ((meta.pages ?? 1) > 1) return null;
  const edge = Math.max(meta.width ?? 0, meta.height ?? 0);

  if (format === "png") {
    if (edge <= IMAGE_MAX_EDGE) return null;
    return { data: await encode(bytes, meta.exif, "png"), ext: ".png" };
  }
  if (format === "jpeg" || format === "webp") {
    if (edge <= IMAGE_MAX_EDGE && bytes.byteLength <= IMAGE_LARGE_BYTES)
      return null;
    const jpeg = await encode(bytes, meta.exif, "jpeg");
    // Already within the size limit and smaller as it was: keep it.
    if (edge <= IMAGE_MAX_EDGE && jpeg.byteLength >= bytes.byteLength)
      return null;
    return { data: jpeg, ext: ".jpg" };
  }
  if (CONVERTED.has(format)) {
    return { data: await encode(bytes, meta.exif, "jpeg"), ext: ".jpg" };
  }
  return null;
}

async function encode(
  bytes: Buffer,
  exif: Buffer | undefined,
  as: "jpeg" | "png",
): Promise<Buffer> {
  let img = sharp(bytes, { failOn: "none" })
    .rotate() // apply EXIF orientation
    .resize({
      width: IMAGE_MAX_EDGE,
      height: IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .keepIccProfile();
  const kept = exif ? keptExif(exif) : null;
  if (kept) img = img.withExif(kept);
  return as === "png"
    ? img.png().toBuffer()
    : img.jpeg({ quality: IMAGE_QUALITY }).toBuffer();
}

// EXIF tags that survive a re-encode: date and camera. Everything else
// (GPS above all, and orientation, which is applied) is dropped.
const IFD0_TAGS: Record<number, string> = {
  0x010f: "Make",
  0x0110: "Model",
  0x0132: "DateTime",
};
const EXIF_IFD_TAGS: Record<number, string> = {
  0x9003: "DateTimeOriginal",
  0x9004: "DateTimeDigitized",
  0x9010: "OffsetTime",
  0x9011: "OffsetTimeOriginal",
  0x9012: "OffsetTimeDigitized",
  0xa433: "LensMake",
  0xa434: "LensModel",
};

/**
 * The kept ASCII tags from a raw EXIF block, in sharp's `withExif` shape
 * (IFD0 is the main image, IFD2 the Exif sub-IFD), or null if none.
 */
export function keptExif(
  raw: Buffer,
): { IFD0?: Record<string, string>; IFD2?: Record<string, string> } | null {
  try {
    let tiff = raw;
    if (tiff.subarray(0, 6).toString("latin1") === "Exif\0\0")
      tiff = tiff.subarray(6);
    const order = tiff.subarray(0, 2).toString("latin1");
    if (order !== "II" && order !== "MM") return null;
    const le = order === "II";
    const u16 = (o: number) =>
      le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o);
    const u32 = (o: number) =>
      le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o);

    const readIfd = (offset: number, wanted: Record<number, string>) => {
      const out: Record<string, string> = {};
      let exifIfd: number | undefined;
      const count = u16(offset);
      for (let i = 0; i < count; i++) {
        const entry = offset + 2 + i * 12;
        const tag = u16(entry);
        const type = u16(entry + 2);
        const n = u32(entry + 4);
        if (tag === 0x8769) exifIfd = u32(entry + 8);
        const name = wanted[tag];
        if (!name || type !== 2 || n === 0) continue; // ASCII only
        const at = n <= 4 ? entry + 8 : u32(entry + 8);
        const value = tiff
          .subarray(at, at + n)
          .toString("latin1")
          .replace(/\0+$/, "")
          .trim();
        if (value) out[name] = value;
      }
      return { out, exifIfd };
    };

    const ifd0 = readIfd(u32(4), IFD0_TAGS);
    const ifd2 = ifd0.exifIfd ? readIfd(ifd0.exifIfd, EXIF_IFD_TAGS).out : {};
    const result: {
      IFD0?: Record<string, string>;
      IFD2?: Record<string, string>;
    } = {};
    if (Object.keys(ifd0.out).length) result.IFD0 = ifd0.out;
    if (Object.keys(ifd2).length) result.IFD2 = ifd2;
    return Object.keys(result).length ? result : null;
  } catch {
    return null; // malformed EXIF: drop it all
  }
}

// ---------- videos ----------

export interface VideoProbe {
  /** Upright (rotation applied). */
  width: number;
  height: number;
  fps: number;
  /** Video stream bits per second. */
  bitrate: number;
  durationSec: number;
  hdr: boolean;
  hasAudio: boolean;
  creationTime?: string;
}

export interface VideoPlan {
  width: number;
  height: number;
  fps: number;
  sourceFps: number;
  bitrate: number;
  hdr: boolean;
  hasAudio: boolean;
  creationTime?: string;
  /** Estimated output size. */
  estimatedBytes: number;
}

export interface FfmpegTools {
  ffmpeg: string;
  ffprobe: string;
  encoder: "h264_videotoolbox" | "libx264";
}

const FF_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

/**
 * Finds ffmpeg and ffprobe (PATH, then Homebrew). Throws a clear error when
 * either is missing. Prefers the VideoToolbox (hardware) encoder on macOS.
 */
export async function findFfmpeg(
  encoder?: FfmpegTools["encoder"],
): Promise<FfmpegTools> {
  const find = async (name: string) => {
    const dirs = [...(process.env.PATH ?? "").split(":"), ...FF_DIRS];
    for (const dir of dirs) {
      if (!dir) continue;
      const p = path.join(dir, name);
      try {
        await fs.promises.access(p, fs.constants.X_OK);
        return p;
      } catch {
        // next
      }
    }
    throw new Error(
      `[SHRINK_NO_FFMPEG] ${name} not found. Install it (brew install ffmpeg) or skip videos with --no-videos.`,
    );
  };
  const ffmpeg = await find("ffmpeg");
  const ffprobe = await find("ffprobe");
  if (!encoder) {
    const { stdout } = await execFileAsync(ffmpeg, [
      "-hide_banner",
      "-encoders",
    ]);
    encoder = /\bh264_videotoolbox\b/.test(stdout)
      ? "h264_videotoolbox"
      : "libx264";
  }
  return { ffmpeg, ffprobe, encoder };
}

const ratio = (s: string | undefined) => {
  if (!s) return 0;
  const [n, d] = s.split("/").map(Number);
  return d ? n / d : n || 0;
};

export async function probeVideo(
  tools: FfmpegTools,
  file: string,
): Promise<VideoProbe | null> {
  const { stdout } = await execFileAsync(
    tools.ffprobe,
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      file,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const info = JSON.parse(stdout);
  const streams: any[] = info.streams ?? [];
  const v = streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
  );
  if (!v) return null;
  const rotation = Number(
    v.side_data_list?.find((d: any) => d.rotation !== undefined)?.rotation ??
      v.tags?.rotate ??
      0,
  );
  const sideways = Math.abs(rotation) % 180 === 90;
  const width = sideways ? v.height : v.width;
  const height = sideways ? v.width : v.height;
  const fps = ratio(v.avg_frame_rate) || ratio(v.r_frame_rate);
  const durationSec = Number(v.duration ?? info.format?.duration ?? 0);
  const fileBytes = Number(info.format?.size ?? 0);
  const bitrate =
    Number(v.bit_rate) ||
    Number(info.format?.bit_rate) ||
    (durationSec ? (fileBytes * 8) / durationSec : 0);
  return {
    width,
    height,
    fps,
    bitrate,
    durationSec,
    hdr: ["smpte2084", "arib-std-b67"].includes(v.color_transfer),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    creationTime: info.format?.tags?.creation_time ?? v.tags?.creation_time,
  };
}

/** Nil when the video already fits. Mirrors `VideoIngest.plan`. */
export function planVideo(p: VideoProbe): VideoPlan | null {
  if (!(p.width > 0 && p.height > 0)) return null;
  const scale = Math.min(1, VIDEO_MAX_EDGE / Math.max(p.width, p.height));
  const width = Math.round((p.width * scale) / 2) * 2;
  const height = Math.round((p.height * scale) / 2) * 2;
  const bitrate = videoBitrate(width, height);
  const oversized = Math.max(p.width, p.height) > VIDEO_MAX_EDGE;
  const fast = p.fps > VIDEO_MAX_FPS + 1;
  const heavy = p.bitrate > bitrate * 1.3;
  if (!(oversized || fast || heavy)) return null;
  const fps = Math.min(p.fps > 0 ? p.fps : VIDEO_MAX_FPS, VIDEO_MAX_FPS);
  const audio = p.hasAudio ? VIDEO_AUDIO_BITRATE : 0;
  return {
    width,
    height,
    fps,
    sourceFps: p.fps,
    bitrate,
    hdr: p.hdr,
    hasAudio: p.hasAudio,
    creationTime: p.creationTime,
    estimatedBytes: Math.round(((bitrate + audio) * p.durationSec) / 8),
  };
}

/** The ffmpeg arguments that carry out a plan. */
export function ffmpegArgs(
  tools: FfmpegTools,
  src: string,
  plan: VideoPlan,
  out: string,
): string[] {
  const fps = Math.round(plan.fps);
  const filters: string[] = [];
  // At or under the cap the source's own timing is kept.
  if (plan.sourceFps > VIDEO_MAX_FPS + 1) filters.push(`fps=${fps}`);
  filters.push(`scale=${plan.width}:${plan.height}:flags=bicubic`);
  if (plan.hdr) {
    // HDR (PQ or HLG) → SDR Rec. 709.
    filters.push(
      "zscale=t=linear:npl=100",
      "format=gbrpf32le",
      "zscale=p=bt709",
      "tonemap=tonemap=hable:desat=0",
      "zscale=t=bt709:m=bt709:r=tv",
    );
  }
  filters.push("format=yuv420p");

  const video =
    tools.encoder === "h264_videotoolbox"
      ? ["-c:v", "h264_videotoolbox", "-allow_sw", "1"]
      : ["-c:v", "libx264", "-preset", "medium"];
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    src,
    "-map",
    "0:v:0",
    ...(plan.hasAudio ? ["-map", "0:a:0"] : []),
    "-vf",
    filters.join(","),
    ...video,
    "-profile:v",
    "high",
    "-b:v",
    String(plan.bitrate),
    "-maxrate",
    String(Math.round(plan.bitrate * 1.5)),
    "-bufsize",
    String(plan.bitrate * 2),
    "-g",
    String(fps * 2),
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    ...(plan.hasAudio
      ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "44100"]
      : ["-an"]),
    // Drop all metadata (location included), keep the recording date.
    "-map_metadata",
    "-1",
    ...(plan.creationTime
      ? ["-metadata", `creation_time=${plan.creationTime}`]
      : []),
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    out,
  ];
}

export async function transcodeVideo(
  tools: FfmpegTools,
  src: string,
  plan: VideoPlan,
  out: string,
): Promise<void> {
  const args = ffmpegArgs(tools, src, plan, out);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(tools.ffmpeg, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-500)}`),
          ),
    );
  });
}
