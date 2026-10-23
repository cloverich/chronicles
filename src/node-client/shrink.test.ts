import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import sharp from "sharp";
import { createClient } from "./factory";
import {
  findFfmpeg,
  keptExif,
  planVideo,
  prepareImage,
  probeVideo,
  type VideoProbe,
} from "./media-policy";
import * as schema from "./schema";

const scratch = fs.mkdtempSync(path.join(tmpdir(), "chronicles-shrink-"));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));

/** Noise, so encoders can't make it tiny. */
function noise(width: number, height: number, channels: 3 | 4 = 3) {
  const raw = crypto.randomBytes(width * height * channels);
  return sharp(raw, { raw: { width, height, channels } });
}

const exif = {
  IFD0: { Make: "TestCam", Model: "T-1000" },
  IFD2: { DateTimeOriginal: "2024:05:01 10:00:00" },
  IFD3: { GPSMapDatum: "WGS-84-SECRET" },
};

describe("prepareImage", () => {
  test("downscales a large JPEG, applies orientation, keeps date and camera, drops GPS", async () => {
    const src = await noise(3000, 2000)
      .withExif(exif)
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 90 })
      .toBuffer();
    const out = await prepareImage(src);
    assert.ok(out);
    assert.equal(out.ext, ".jpg");
    const meta = await sharp(out.data).metadata();
    assert.equal(meta.format, "jpeg");
    // Rotated 90°: portrait now, long edge 2048.
    assert.equal(meta.height, 2048);
    assert.equal(meta.width, 1365);
    assert.ok(!meta.orientation || meta.orientation === 1);
    const kept = keptExif(meta.exif!);
    assert.equal(kept?.IFD0?.Make, "TestCam");
    assert.equal(kept?.IFD0?.Model, "T-1000");
    assert.equal(kept?.IFD2?.DateTimeOriginal, "2024:05:01 10:00:00");
    assert.ok(!meta.exif!.includes("WGS-84-SECRET"));
    assert.ok((await sharp(src).metadata()).exif!.includes("WGS-84-SECRET"));
  });

  test("leaves a JPEG that fits", async () => {
    const src = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "#888" },
    })
      .jpeg()
      .toBuffer();
    assert.equal(await prepareImage(src), null);
  });

  test("re-encodes a heavy JPEG within 2048 px", async () => {
    const src = await noise(2000, 1500).jpeg({ quality: 100 }).toBuffer();
    assert.ok(src.byteLength > 1_500_000);
    const out = await prepareImage(src);
    assert.ok(out && out.data.byteLength < src.byteLength);
    assert.equal((await sharp(out.data).metadata()).width, 2000);
  });

  test("WebP over 2048 px becomes JPEG", async () => {
    const src = await noise(2500, 1000).webp().toBuffer();
    const out = await prepareImage(src);
    assert.equal(out?.ext, ".jpg");
    assert.equal((await sharp(out!.data).metadata()).width, 2048);
  });

  test("PNG stays PNG and is only downscaled", async () => {
    const small = await noise(1200, 800, 4).png().toBuffer();
    assert.ok(small.byteLength > 1_500_000);
    assert.equal(await prepareImage(small), null);

    const big = await noise(3000, 100, 4).png().toBuffer();
    const out = await prepareImage(big);
    assert.equal(out?.ext, ".png");
    const meta = await sharp(out!.data).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 2048);
    assert.equal(meta.hasAlpha, true);
  });

  test("GIF and non-images are untouched", async () => {
    const gif = await noise(3000, 100).gif().toBuffer();
    assert.equal(await prepareImage(gif), null);
    await assert.rejects(prepareImage(Buffer.from("%PDF-1.4 not an image")));
  });
});

describe("planVideo", () => {
  const probe = (p: Partial<VideoProbe>): VideoProbe => ({
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 2_000_000,
    durationSec: 10,
    hdr: false,
    hasAudio: true,
    ...p,
  });

  test("a video that fits is left alone", () => {
    assert.equal(planVideo(probe({})), null);
  });

  test("4K goes to 1920 px at ~5 Mbps", () => {
    const plan = planVideo(probe({ width: 3840, height: 2160, bitrate: 4e7 }));
    assert.equal(plan?.width, 1920);
    assert.equal(plan?.height, 1080);
    assert.equal(plan?.bitrate, 4_976_640);
    assert.equal(
      plan?.estimatedBytes,
      Math.round(((4_976_640 + 128_000) * 10) / 8),
    );
  });

  test("slow motion goes to 30 fps; heavy 720p to ~2.2 Mbps", () => {
    assert.equal(planVideo(probe({ fps: 240 }))?.fps, 30);
    const heavy = planVideo(probe({ bitrate: 20_000_000 }));
    assert.equal(heavy?.bitrate, 2_211_840);
    assert.equal(heavy?.width, 1280);
    // Just under 1.3× the target: left alone.
    assert.equal(planVideo(probe({ bitrate: 2_211_840 * 1.29 })), null);
  });

  test("portrait sizes stay even", () => {
    const plan = planVideo(probe({ width: 1081, height: 2401 }));
    assert.equal(plan?.height, 1920);
    assert.equal(plan?.width % 2, 0);
  });
});

async function ffmpegOrSkip(t: { skip: (msg: string) => void }) {
  try {
    return await findFfmpeg();
  } catch {
    t.skip("ffmpeg not installed");
    return null;
  }
}

function makeVideo(
  ffmpeg: string,
  out: string,
  opts: { size: string; rate: number; hdr?: boolean },
) {
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${opts.size}:rate=${opts.rate}:duration=1`,
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:v",
    "libx264",
    "-b:v",
    "20M",
    ...(opts.hdr
      ? [
          "-vf",
          "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc,format=yuv420p10le",
        ]
      : ["-pix_fmt", "yuv420p"]),
    "-c:a",
    "aac",
    "-metadata",
    "creation_time=2024-05-01T10:00:00Z",
    "-metadata",
    "location=+37.7749-122.4194/",
    "-shortest",
    "-y",
    out,
  ]);
}

describe("ShrinkClient", () => {
  test("dry run reports, apply rewrites notes and drops old blobs, re-run is a no-op", async (t) => {
    const tools = await ffmpegOrSkip(t);
    if (!tools) return;
    const notesDir = path.join(scratch, "lib");
    const client = await createClient({ dbPath: ":memory:", notesDir });
    await client.journals.create({ name: "work" });
    const store = client.files.attachments;

    const bigJpeg = await noise(3000, 2000).jpeg({ quality: 90 }).toBuffer();
    const fitPng = await noise(200, 200).png().toBuffer();
    const gif = await noise(3000, 100).gif().toBuffer();
    const mov = path.join(scratch, "clip.mov");
    makeVideo(tools.ffmpeg, mov, { size: "1280x720", rate: 60 });

    const a = await store.putBytes(bigJpeg, { ext: ".jpg" });
    const b = await store.putBytes(fitPng, { ext: ".png" });
    const c = await store.putBytes(gif, { ext: ".gif" });
    const v = await store.putFile(mov);
    const unused = await store.putBytes(Buffer.from("orphan"), { ext: ".txt" });
    fs.writeFileSync(store.pathFor(a.sha256, a.ext) + ".tmp-1-abcd", "x");

    const content = [
      `![big](${a.url})`,
      `![small](${b.url}) and again ![big](${a.url})`,
      `![anim](${c.url})`,
      `![clip](${v.url})`,
    ].join("\n\n");
    const meta = {
      tags: [],
      title: "Trip",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };
    const id = await client.documents.createDocument({
      journal: "work",
      content,
      frontMatter: meta,
    });
    const other = await client.documents.createDocument({
      journal: "work",
      content: `cover ![x](${a.url})`,
      frontMatter: { ...meta, title: "Other" },
    });
    const before = await client.documents.findById({ id });

    const dry = await client.shrink.run();
    assert.equal(dry.applied, false);
    assert.equal(dry.images.files, 1);
    assert.equal(dry.videos.files, 1);
    assert.equal(dry.notes, 2);
    assert.equal(dry.unused.files, 2); // orphan + temp file
    assert.ok(dry.library.after < dry.library.before);
    assert.equal((await client.documents.findById({ id })).content, content);
    assert.ok(fs.existsSync(store.pathFor(unused.sha256, unused.ext)));

    const real = await client.shrink.run({ apply: true, ffmpeg: tools });
    assert.deepEqual(real.errors, []);
    assert.equal(real.images.files, 1);
    assert.equal(real.videos.files, 1);
    assert.equal(real.notes, 2);
    assert.equal(real.unused.files, 2);
    assert.ok(real.images.after < real.images.before);
    assert.ok(real.videos.after < real.videos.before);

    const after = await client.documents.findById({ id });
    assert.equal(after.frontMatter.updatedAt, "2024-01-02T00:00:00.000Z");
    assert.equal(after.frontMatter.updatedAt, before.frontMatter.updatedAt);
    assert.notEqual(after.revision, before.revision);
    assert.ok(!after.content.includes(a.sha256));
    assert.ok(!after.content.includes(v.sha256));
    assert.ok(after.content.includes(b.url) && after.content.includes(c.url));
    const refs = [
      ...after.content.matchAll(
        /chronicles:\/\/attachment\/([0-9a-f]{64})(\.\w+)/g,
      ),
    ].map((m) => ({ sha: m[1], ext: m[2] }));
    assert.equal(refs[0].sha, refs[2].sha); // both mentions of the JPEG
    const newJpeg = refs[0];
    const newVideo = refs[4];
    assert.equal(newJpeg.ext, ".jpg");
    assert.equal(newVideo.ext, ".mp4");
    assert.ok(
      (await client.documents.findById({ id: other })).content.includes(
        newJpeg.sha,
      ),
    );

    // Derived rows and FTS follow the new content.
    const links = client.db
      .select()
      .from(schema.imageLinks)
      .all()
      .filter((l) => l.documentId === id)
      .map((l) => l.imagePath);
    assert.ok(links.some((l) => l.includes(newJpeg.sha)));
    assert.ok(!links.some((l) => l.includes(a.sha256)));
    const fts = client.sqlite
      .prepare("SELECT content FROM documents_fts WHERE id = ?")
      .get(id) as { content: string };
    assert.equal(fts.content, after.content);

    // Old blobs and unused files are gone; the new ones exist.
    for (const gone of [a, v, unused]) {
      assert.ok(!fs.existsSync(store.pathFor(gone.sha256, gone.ext)));
    }
    assert.ok(!fs.existsSync(store.pathFor(a.sha256, a.ext) + ".tmp-1-abcd"));
    const rows = client.db.select().from(schema.attachments).all();
    assert.deepEqual(
      rows.map((r) => r.sha256 + r.ext).sort(),
      [b, c]
        .map((x) => x.sha256 + x.ext)
        .concat([newJpeg.sha + newJpeg.ext, newVideo.sha + newVideo.ext])
        .sort(),
    );

    // The new video: 1280x720, 30 fps, H.264 + AAC, date kept, location gone.
    const newPath = store.pathFor(newVideo.sha, newVideo.ext);
    const probed = await probeVideo(tools, newPath);
    assert.equal(probed?.width, 1280);
    assert.equal(probed?.fps, 30);
    assert.equal(probed?.hasAudio, true);
    assert.match(probed?.creationTime ?? "", /^2024-05-01T10:00:00/);
    const tags = execFileSync(tools.ffprobe, [
      "-v",
      "error",
      "-show_format",
      newPath,
    ]).toString();
    assert.ok(!tags.includes("37.7749"));

    const again = await client.shrink.run({ apply: true, ffmpeg: tools });
    assert.equal(again.images.files + again.videos.files, 0);
    assert.equal(again.unused.files, 0);
    assert.equal(again.notes, 0);
    assert.equal(again.library.after, again.library.before);
  });

  test("an image named for the wrong format is renamed, not re-encoded", async () => {
    const notesDir = path.join(scratch, "lib-ext");
    const client = await createClient({ dbPath: ":memory:", notesDir });
    await client.journals.create({ name: "work" });
    const store = client.files.attachments;

    // The old desktop ingest: WebP bytes under the upload's `.png` name.
    const webp = await noise(300, 200).webp().toBuffer();
    const png = await noise(100, 100).png().toBuffer();
    const a = await store.putBytes(webp, { ext: ".png" });
    const b = await store.putBytes(png, { ext: ".png" });
    const content = `![x](${a.url})\n\n![y](${b.url})`;
    const id = await client.documents.createDocument({
      journal: "work",
      content,
      frontMatter: {
        tags: [],
        title: "Old",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-02T00:00:00.000Z",
        cover: a.url,
      },
    });
    const before = await client.documents.findById({ id });

    const dry = await client.shrink.run({ videos: false });
    assert.equal(dry.renamed.files, 1);
    assert.equal(dry.notes, 1);
    assert.equal(dry.images.files, 0);
    assert.equal((await client.documents.findById({ id })).content, content);

    const real = await client.shrink.run({ apply: true, videos: false });
    assert.deepEqual(real.errors, []);
    assert.equal(real.renamed.files, 1);
    const after = await client.documents.findById({ id });
    const renamed = `chronicles://attachment/${a.sha256}.webp`;
    assert.equal(after.content, `![x](${renamed})\n\n![y](${b.url})`);
    assert.equal(after.frontMatter.cover, renamed);
    assert.equal(after.frontMatter.updatedAt, before.frontMatter.updatedAt);
    assert.notEqual(after.revision, before.revision);
    assert.ok(!fs.existsSync(store.pathFor(a.sha256, ".png")));
    assert.deepEqual(
      fs.readFileSync(store.pathFor(a.sha256, ".webp")),
      Buffer.from(webp),
    );
    const row = client.db
      .select()
      .from(schema.attachments)
      .all()
      .find((r) => r.sha256 === a.sha256);
    assert.equal(row?.ext, ".webp");
    assert.equal(row?.mime, "image/webp");

    const again = await client.shrink.run({ apply: true, videos: false });
    assert.equal(again.renamed.files, 0);
    assert.equal(again.notes, 0);
  });

  test("HDR (HLG) video maps to SDR Rec. 709", async (t) => {
    const tools = await ffmpegOrSkip(t);
    if (!tools) return;
    const notesDir = path.join(scratch, "hdr");
    const client = await createClient({ dbPath: ":memory:", notesDir });
    await client.journals.create({ name: "work" });
    const mov = path.join(scratch, "hdr.mov");
    makeVideo(tools.ffmpeg, mov, { size: "1280x720", rate: 30, hdr: true });
    const v = await client.files.attachments.putFile(mov);
    await client.documents.createDocument({
      journal: "work",
      content: `![clip](${v.url})`,
      frontMatter: {
        tags: [],
        title: "HDR",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });
    assert.equal((await probeVideo(tools, mov))?.hdr, true);
    const report = await client.shrink.run({ apply: true, ffmpeg: tools });
    assert.deepEqual(report.errors, []);
    assert.equal(report.videos.files, 1);
    const row = client.db.select().from(schema.attachments).all()[0];
    const out = execFileSync(tools.ffprobe, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=color_transfer,color_primaries,pix_fmt,codec_name",
      "-of",
      "json",
      client.files.attachments.pathFor(row.sha256, row.ext),
    ]).toString();
    const s = JSON.parse(out).streams[0];
    assert.equal(s.codec_name, "h264");
    assert.equal(s.color_transfer, "bt709");
    assert.equal(s.color_primaries, "bt709");
    assert.equal(s.pix_fmt, "yuv420p");
  });
});
