/**
 * "Shrink library": applies the Large media policy (media-policy.ts) to the
 * attachments notes already use, then removes attachments no note uses.
 * Each re-encoded file is stored as a new content-addressed attachment, the
 * notes that reference the old one are rewritten (new revision, same
 * updatedAt), and the old blob is deleted. A file that already fits is never
 * touched, so a second run does nothing.
 *
 * Crash safety: the new blob is written before the notes switch to it, and
 * each file's switch is one transaction. A crash leaves at worst an unused
 * blob, which the sweep removes; a re-run redoes the file.
 *
 * The default is a dry run: images are re-encoded in memory (exact sizes),
 * videos are estimated from their planned bitrate and duration.
 */
import { sql } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

import type { AttachmentStore } from "./attachments";
import {
  findFfmpeg,
  planVideo,
  prepareImage,
  probeVideo,
  transcodeVideo,
  VIDEO_EXTENSIONS,
  type FfmpegTools,
} from "./media-policy";
import * as schema from "./schema";
import { attachments, documents } from "./schema";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
]);

export interface ShrinkOptions {
  /** Write changes. Without it nothing is written (dry run). */
  apply?: boolean;
  /** Default true. */
  images?: boolean;
  /** Default true. */
  videos?: boolean;
  /** Remove attachments no note references. Default true. */
  sweep?: boolean;
  /** Defaults to ffmpeg found on PATH or in Homebrew. */
  ffmpeg?: FfmpegTools;
  /** Images re-encoded at once. Default 4. */
  concurrency?: number;
  onFile?: (file: ShrinkFileResult) => void;
}

export interface ShrinkFileResult {
  /** `<sha256><ext>` */
  name: string;
  kind: "image" | "video";
  before: number;
  after: number;
  /** Video sizes in a dry run are estimates. */
  estimated: boolean;
  newName?: string;
  notes: number;
  ms: number;
}

export interface Tally {
  files: number;
  before: number;
  after: number;
}

export interface ShrinkReport {
  applied: boolean;
  images: Tally;
  videos: Tally;
  /** Notes rewritten (or, in a dry run, that would be). */
  notes: number;
  /** Attachments no note references (removed when applied). */
  unused: { files: number; bytes: number };
  /** Files that couldn't be read or re-encoded; left as they were. */
  errors: { name: string; error: string }[];
  /** Bytes in `_attachments/`, before and after (after is estimated in a dry run). */
  library: { before: number; after: number };
  ms: number;
}

type Row = { sha256: string; ext: string; originalName: string | null };

export class ShrinkClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private store: AttachmentStore,
  ) {}

  run = async (opts: ShrinkOptions = {}): Promise<ShrinkReport> => {
    const started = Date.now();
    const apply = !!opts.apply;
    const report: ShrinkReport = {
      applied: apply,
      images: { files: 0, before: 0, after: 0 },
      videos: { files: 0, before: 0, after: 0 },
      notes: 0,
      unused: { files: 0, bytes: 0 },
      errors: [],
      library: { before: 0, after: 0 },
      ms: 0,
    };
    const notes = new Set<string>();
    report.library.before = (await this.poolFiles()).reduce(
      (n, f) => n + f.size,
      0,
    );

    const referenced = this.referencedShas();
    const rows = this.db
      .select({
        sha256: attachments.sha256,
        ext: attachments.ext,
        originalName: attachments.originalName,
      })
      .from(attachments)
      .all()
      .filter((r) => referenced.has(r.sha256));

    const record = (
      row: Row,
      kind: "image" | "video",
      before: number,
      after: number,
      estimated: boolean,
      noteIds: string[],
      newName: string | undefined,
      t0: number,
    ) => {
      const tally = kind === "image" ? report.images : report.videos;
      tally.files++;
      tally.before += before;
      tally.after += after;
      noteIds.forEach((id) => notes.add(id));
      opts.onFile?.({
        name: row.sha256 + row.ext,
        kind,
        before,
        after,
        estimated,
        newName,
        notes: noteIds.length,
        ms: Date.now() - t0,
      });
    };
    const fail = (row: Row, err: unknown) =>
      report.errors.push({
        name: row.sha256 + row.ext,
        error: err instanceof Error ? err.message : String(err),
      });

    if (opts.images !== false) {
      const images = rows.filter((r) => IMAGE_EXTENSIONS.has(r.ext));
      await mapLimit(images, opts.concurrency ?? 4, async (row) => {
        const t0 = Date.now();
        try {
          const file = this.store.pathFor(row.sha256, row.ext);
          const bytes = await fs.promises.readFile(file);
          if (bytes.byteLength === 0) return;
          const prepared = await prepareImage(bytes);
          if (!prepared) return;
          if (!apply) {
            record(
              row,
              "image",
              bytes.byteLength,
              prepared.data.byteLength,
              false,
              this.notesReferencing(row.sha256),
              undefined,
              t0,
            );
            return;
          }
          const stored = await this.store.putBytes(prepared.data, {
            ext: prepared.ext,
            originalName: row.originalName ?? undefined,
          });
          const { notesUpdated } = await this.store.replaceAttachment(
            row,
            stored,
          );
          record(
            row,
            "image",
            bytes.byteLength,
            prepared.data.byteLength,
            false,
            notesUpdated,
            stored.sha256 + stored.ext,
            t0,
          );
        } catch (err) {
          fail(row, err);
        }
      });
    }

    if (opts.videos !== false) {
      const videos = rows.filter((r) => VIDEO_EXTENSIONS.has(r.ext));
      if (videos.length > 0) {
        const tools = opts.ffmpeg ?? (await findFfmpeg());
        const workDir = await fs.promises.mkdtemp(
          path.join(os.tmpdir(), "chronicles-shrink-"),
        );
        try {
          for (const row of videos) {
            const t0 = Date.now();
            try {
              const file = this.store.pathFor(row.sha256, row.ext);
              const before = (await fs.promises.stat(file)).size;
              if (before === 0) continue;
              const probe = await probeVideo(tools, file);
              const plan = probe && planVideo(probe);
              if (!plan) continue;
              if (!apply) {
                record(
                  row,
                  "video",
                  before,
                  Math.min(before, plan.estimatedBytes),
                  true,
                  this.notesReferencing(row.sha256),
                  undefined,
                  t0,
                );
                continue;
              }
              const out = path.join(workDir, `${row.sha256}.mp4`);
              await transcodeVideo(tools, file, plan, out);
              const after = (await fs.promises.stat(out)).size;
              // Not smaller (a low-bitrate fast clip, say): keep the original.
              if (after >= before) {
                await fs.promises.rm(out, { force: true });
                continue;
              }
              const stored = await this.store.putFile(
                out,
                row.originalName ?? undefined,
              );
              await fs.promises.rm(out, { force: true });
              const { notesUpdated } = await this.store.replaceAttachment(
                row,
                stored,
              );
              record(
                row,
                "video",
                before,
                after,
                false,
                notesUpdated,
                stored.sha256 + stored.ext,
                t0,
              );
            } catch (err) {
              fail(row, err);
            }
          }
        } finally {
          await fs.promises.rm(workDir, { recursive: true, force: true });
        }
      }
    }

    report.notes = notes.size;

    if (opts.sweep !== false) {
      report.unused = await this.sweep({ apply });
    }

    const saved =
      report.images.before -
      report.images.after +
      report.videos.before -
      report.videos.after;
    report.library.after = apply
      ? (await this.poolFiles()).reduce((n, f) => n + f.size, 0)
      : report.library.before - saved - report.unused.bytes;
    report.ms = Date.now() - started;
    return report;
  };

  /**
   * Attachments no note references: files in `_attachments/` (including
   * leftover temp files) and `attachments` rows. Removed when `apply`.
   * Run only while nothing else writes to the library.
   */
  sweep = async ({ apply = false }: { apply?: boolean } = {}): Promise<{
    files: number;
    bytes: number;
  }> => {
    const referenced = this.referencedShas();
    const unused = (await this.poolFiles()).filter(
      (f) => f.name.includes(".tmp-") || !referenced.has(f.name.slice(0, 64)),
    );
    if (apply) {
      for (const f of unused) await fs.promises.rm(f.path, { force: true });
      const rows = this.db
        .select({ sha256: attachments.sha256 })
        .from(attachments)
        .all()
        .filter((r) => !referenced.has(r.sha256));
      for (const r of rows) {
        this.db
          .delete(attachments)
          .where(sql`${attachments.sha256} = ${r.sha256}`)
          .run();
      }
    }
    return {
      files: unused.length,
      bytes: unused.reduce((n, f) => n + f.size, 0),
    };
  };

  /** Every sha256 that appears in a note's content or front matter. */
  private referencedShas(): Set<string> {
    const shas = new Set<string>();
    const rows = this.db
      .select({
        content: documents.content,
        frontmatter: documents.frontmatter,
      })
      .from(documents)
      .all();
    for (const r of rows) {
      for (const text of [r.content, r.frontmatter]) {
        for (const m of text.matchAll(/[0-9a-f]{64}/g)) shas.add(m[0]);
      }
    }
    return shas;
  }

  private notesReferencing(sha256: string): string[] {
    return this.db
      .select({ id: documents.id })
      .from(documents)
      .where(
        sql`instr(${documents.content}, ${sha256}) > 0 OR instr(${documents.frontmatter}, ${sha256}) > 0`,
      )
      .all()
      .map((r) => r.id);
  }

  /** Files in the pool (`_attachments/<xx>/<name>`). */
  private async poolFiles(): Promise<
    { name: string; path: string; size: number }[]
  > {
    const out: { name: string; path: string; size: number }[] = [];
    let dirs: fs.Dirent[];
    try {
      dirs = await fs.promises.readdir(this.store.dir, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === "ENOENT") return out;
      throw err;
    }
    for (const d of dirs) {
      if (!d.isDirectory() || d.name.length !== 2) continue;
      const dir = path.join(this.store.dir, d.name);
      for (const f of await fs.promises.readdir(dir, { withFileTypes: true })) {
        if (!f.isFile() || f.name.startsWith(".")) continue;
        const p = path.join(dir, f.name);
        out.push({
          name: f.name,
          path: p,
          size: (await fs.promises.stat(p)).size,
        });
      }
    }
    return out;
  }
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}
