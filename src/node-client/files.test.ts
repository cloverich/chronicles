import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import { createClient } from "./factory";
import { findFfmpeg } from "./media-policy";

const scratch = fs.mkdtempSync(path.join(tmpdir(), "chronicles-files-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

function noise(width: number, height: number) {
  return sharp(crypto.randomBytes(width * height * 3), {
    raw: { width, height, channels: 3 },
  });
}

const arrayBuffer = (b: Buffer) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function client() {
  const notesDir = fs.mkdtempSync(path.join(scratch, "notes-"));
  return createClient({ dbPath: ":memory:", notesDir });
}

async function stored(c: Awaited<ReturnType<typeof client>>, url: string) {
  const [, file] = url.match(/attachment\/([0-9a-f]{64}\.\w+)$/)!;
  const ext = path.extname(file);
  return {
    ext,
    bytes: await fs.promises.readFile(
      c.files.attachments.pathFor(file.slice(0, 64), ext),
    ),
  };
}

describe("uploads follow the shared media policy", () => {
  test("a large photo becomes a 2048 px JPEG", async () => {
    const c = await client();
    const src = await noise(3000, 2000).jpeg({ quality: 95 }).toBuffer();
    const { url } = await c.files.uploadImageBytes(arrayBuffer(src), "a.jpg");
    const out = await stored(c, url);
    assert.equal(out.ext, ".jpg");
    const meta = await sharp(out.bytes).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 2048);
  });

  test("a screenshot stays PNG; a small image is stored as it is", async () => {
    const c = await client();
    const png = await noise(400, 300).png().toBuffer();
    // Named .jpg on purpose: the stored extension follows the real format.
    const { url } = await c.files.uploadImageBytes(arrayBuffer(png), "x.jpg");
    const out = await stored(c, url);
    assert.equal(out.ext, ".png");
    assert.ok(out.bytes.equals(png));
  });

  test("a big, fast video becomes 1080p H.264", async (t) => {
    let tools;
    try {
      tools = await findFfmpeg();
    } catch {
      t.skip("ffmpeg not installed");
      return;
    }
    const c = await client();
    const mov = path.join(scratch, "big.mov");
    execFileSync(tools.ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=2560x1440:rate=60:duration=1",
      "-c:v",
      "libx264",
      "-b:v",
      "30M",
      "-pix_fmt",
      "yuv420p",
      "-y",
      mov,
    ]);
    const src = await fs.promises.readFile(mov);
    const { url, warning } = await c.files.uploadVideoBytes(
      arrayBuffer(src),
      "big.mov",
    );
    assert.equal(warning, undefined);
    const out = await stored(c, url);
    assert.equal(out.ext, ".mp4");
    const probe = execFileSync(tools.ffprobe, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height",
      "-of",
      "csv=p=0",
      c.files.attachments.pathFor(url.match(/([0-9a-f]{64})/)![1], ".mp4"),
    ])
      .toString()
      .trim();
    assert.equal(probe, "h264,1920,1080");
    assert.ok(out.bytes.byteLength < src.byteLength);
  });

  test("isVideoName", async () => {
    const c = await client();
    assert.ok(c.files.isVideoName("IMG_1.MOV"));
    assert.ok(c.files.isVideoName("clip.mp4"));
    assert.ok(!c.files.isVideoName("photo.jpg"));
  });
});
