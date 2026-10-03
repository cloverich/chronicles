import crypto from "crypto";
import { sql } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import {
  attachmentPoolPath,
  attachmentUrl,
  normalizeAttachmentExt,
} from "../markdown/attachmentRefs";
import { rewriteUrls } from "../markdown/rewriteUrls";
import { derive } from "./derive";
import { refreshRevision } from "./documents";
import * as schema from "./schema";
import { attachments, documents } from "./schema";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

export interface StoredAttachment {
  sha256: string;
  ext: string;
  url: string;
  /** The blob was already in the store. */
  existed: boolean;
}

/**
 * Content-addressed attachment store: blobs live at
 * `<notesDir>/_attachments/<sha[0:2]>/<sha><ext>` (the backup pool layout) and
 * are described by the `attachments` table. Blobs are immutable; nothing is
 * garbage-collected automatically.
 */
export class AttachmentStore {
  readonly dir: string;

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    notesDir: string,
  ) {
    this.dir = path.join(notesDir, "_attachments");
  }

  pathFor = (sha256: string, ext: string): string =>
    path.join(this.dir, attachmentPoolPath(sha256, ext));

  /** Store bytes (hashed as given) and record them; idempotent. */
  putBytes = async (
    bytes: Uint8Array,
    opts: { ext: string; originalName?: string },
  ): Promise<StoredAttachment> => {
    const ext = normalizeAttachmentExt("x" + opts.ext);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const dest = this.pathFor(sha256, ext);

    const existed = fs.existsSync(dest);
    if (!existed) {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      const tmp = `${dest}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
      await fs.promises.writeFile(tmp, bytes);
      await fs.promises.rename(tmp, dest);
    }

    this.db
      .insert(attachments)
      .values({
        sha256,
        ext,
        mime: MIME[ext] ?? "application/octet-stream",
        byteSize: bytes.byteLength,
        originalName: opts.originalName ?? null,
      })
      .onConflictDoNothing()
      .run();

    return { sha256, ext, url: attachmentUrl(sha256, ext), existed };
  };

  putFile = async (
    srcPath: string,
    originalName = path.basename(srcPath),
  ): Promise<StoredAttachment> => {
    const bytes = await fs.promises.readFile(srcPath);
    return this.putBytes(bytes, {
      ext: normalizeAttachmentExt(srcPath),
      originalName,
    });
  };

  /**
   * One-time upgrade of the legacy flat layout (`_attachments/<name>`,
   * referenced as `../_attachments/<name>`). Crash-safe and re-runnable:
   * 1. copy each flat file into the pool and record it;
   * 2. rewrite every reference in one transaction (re-deriving changed notes);
   * 3. only then delete the flat originals.
   * References to files that don't exist are left as they were.
   */
  migrateLegacyLayout = async (): Promise<{
    files: number;
    notesUpdated: number;
  }> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(this.dir, { withFileTypes: true });
    } catch (err: any) {
      if (err?.code === "ENOENT") return { files: 0, notesUpdated: 0 };
      throw err;
    }
    const flat = entries.filter((e) => e.isFile() && !e.name.startsWith("."));
    if (flat.length === 0) return { files: 0, notesUpdated: 0 };

    const urlByName = new Map<string, string>();
    for (const e of flat) {
      const stored = await this.putFile(path.join(this.dir, e.name));
      urlByName.set(e.name, stored.url);
    }

    const rewrite = (url: string) => {
      const m = url.match(
        /^(?:chronicles:\/\/)?(?:\.\.?\/)?_attachments\/(.+)$/,
      );
      if (!m) return undefined;
      let name = m[1].split("?")[0];
      try {
        name = decodeURIComponent(name);
      } catch {
        // keep raw
      }
      return urlByName.get(name);
    };

    let notesUpdated = 0;
    this.db.transaction((trx) => {
      const rows = trx
        .select({
          id: documents.id,
          title: documents.title,
          content: documents.content,
        })
        .from(documents)
        .where(sql`instr(${documents.content}, '_attachments/') > 0`)
        .all();
      for (const row of rows) {
        const content = rewriteUrls(row.content, rewrite).markdown;
        if (content === row.content) continue;
        trx
          .update(documents)
          .set({ content })
          .where(sql`${documents.id} = ${row.id}`)
          .run();
        derive(trx, { id: row.id, title: row.title, content });
        refreshRevision(trx, row.id);
        notesUpdated++;
      }
    });

    for (const e of flat) {
      await fs.promises.rm(path.join(this.dir, e.name), { force: true });
    }

    console.log(
      `[attachments] migrated ${flat.length} files to the content-addressed layout; updated ${notesUpdated} notes`,
    );
    return { files: flat.length, notesUpdated };
  };
}
