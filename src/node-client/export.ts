import { eq } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import {
  attachmentPoolPath,
  parseAttachmentUrl,
} from "../markdown/attachmentRefs";
import { parseNoteLink } from "../markdown/noteLinks";
import { rewriteUrls } from "../markdown/rewriteUrls";
import { createId } from "../preload/client/util";
import { compareCodePoints, serializeNote } from "./canonical-note";
import {
  assignJournalDirs,
  encodeLinkSegment,
  EXPORT_FORMAT_VERSION,
} from "./export-layout";
import { isSameOrInside, pathExists } from "./fs-guards";
import * as schema from "./schema";
import { documents, documentTags, journals } from "./schema";

export interface ExportReport {
  destDir: string;
  notes: number;
  attachments: { copied: number; missing: string[] };
}

export interface ManifestJournal {
  id: string;
  name: string;
  dir: string;
  archivedAt: string | null;
}

export interface ManifestNote {
  id: string;
  journalId: string;
  path: string;
  revision: string;
}

export interface ManifestAttachment {
  path: string;
  sha256: string;
  ext: string;
  byteSize: number;
}

export interface Manifest {
  formatVersion: string;
  journals: ManifestJournal[];
  notes: ManifestNote[];
  attachments: ManifestAttachment[];
}

export class ExportClient {
  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private notesDir: string,
  ) {}

  export = async (destDir: string): Promise<ExportReport> => {
    const resolvedDest = path.resolve(destDir);
    const resolvedNotesDir = path.resolve(this.notesDir);

    if (await pathExists(resolvedDest)) {
      throw new Error(
        `[EXPORT_DEST_EXISTS] Export destination already exists: ${resolvedDest}`,
      );
    }

    if (
      isSameOrInside(resolvedDest, resolvedNotesDir) ||
      isSameOrInside(resolvedNotesDir, resolvedDest)
    ) {
      throw new Error(
        `[EXPORT_DEST_CONFLICT] Export destination must not be inside (or contain) the notes directory: ${resolvedDest}`,
      );
    }

    const tmpDir = path.join(
      path.dirname(resolvedDest),
      "." + path.basename(resolvedDest) + ".tmp-" + createId(),
    );

    try {
      await fs.promises.mkdir(tmpDir, { recursive: true });

      const report = await this.writeExport(tmpDir);

      await fs.promises.rename(tmpDir, resolvedDest);

      return { destDir: resolvedDest, ...report };
    } catch (err) {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
      throw err;
    }
  };

  private attachmentPath = (a: { sha256: string; ext: string }) =>
    path.join(
      this.notesDir,
      "_attachments",
      attachmentPoolPath(a.sha256, a.ext),
    );

  private writeExport = async (
    tmpDir: string,
  ): Promise<Omit<ExportReport, "destDir">> => {
    const journalRows = await this.db.select().from(journals);
    const dirsByName = assignJournalDirs(journalRows.map((j) => j.name));
    // journal id → export directory
    const dirs = new Map(
      journalRows.map((j) => [j.id, dirsByName.get(j.name)!]),
    );

    const rows = await this.db.select().from(documents).orderBy(documents.id);
    const journalOf = new Map(rows.map((r) => [r.id, r.journalId]));

    const manifestNotes: ManifestNote[] = [];
    const attachments = new Map<string, ManifestAttachment>();
    const missing = new Set<string>();

    for (const row of rows) {
      const tagRows = await this.db
        .select({ tag: documentTags.tag })
        .from(documentTags)
        .where(eq(documentTags.documentId, row.id));

      const referenced: { sha256: string; ext: string }[] = [];
      const content = rewriteUrls(row.content, (url) => {
        const attachment = parseAttachmentUrl(url);
        if (attachment) {
          const source = this.attachmentPath(attachment);
          if (!fs.existsSync(source)) {
            missing.add(`${attachment.sha256}${attachment.ext}`);
            return undefined;
          }
          referenced.push(attachment);
          return `../_attachments/${attachmentPoolPath(attachment.sha256, attachment.ext)}`;
        }

        const link = parseNoteLink(url);
        if (!link) return undefined;
        const targetJournal = journalOf.get(link.noteId);
        if (!targetJournal) return undefined;
        const dir = encodeLinkSegment(dirs.get(targetJournal)!);
        return `../${dir}/${link.noteId}.md`;
      }).markdown;

      const fileContents = serializeNote({
        id: row.id,
        title: row.title,
        journal: row.journalId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        tags: tagRows.map((t) => t.tag),
        frontMatter: row.frontmatter ? JSON.parse(row.frontmatter) : {},
        content,
      });

      const dir = dirs.get(row.journalId)!;
      const relPath = `${dir}/${row.id}.md`;
      await fs.promises.mkdir(path.join(tmpDir, dir), {
        recursive: true,
      });
      await fs.promises.writeFile(
        path.join(tmpDir, relPath),
        fileContents,
        "utf8",
      );
      manifestNotes.push({
        id: row.id,
        journalId: row.journalId,
        path: relPath,
        revision: row.revision,
      });

      for (const { sha256, ext } of referenced) {
        const rel = `_attachments/${attachmentPoolPath(sha256, ext)}`;
        if (attachments.has(rel)) continue;
        const dest = path.join(tmpDir, rel);
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        await fs.promises.copyFile(this.attachmentPath({ sha256, ext }), dest);
        const { size } = await fs.promises.stat(dest);
        attachments.set(rel, { path: rel, sha256, ext, byteSize: size });
      }
    }

    const manifest: Manifest = {
      formatVersion: EXPORT_FORMAT_VERSION,
      journals: journalRows
        .map((j) => ({
          id: j.id,
          name: j.name,
          dir: dirsByName.get(j.name)!,
          archivedAt: j.archivedAt,
        }))
        .sort((a, b) => compareCodePoints(a.name, b.name)),
      notes: manifestNotes,
      attachments: Array.from(attachments.values()).sort((a, b) =>
        compareCodePoints(a.path, b.path),
      ),
    };

    await fs.promises.writeFile(
      path.join(tmpDir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
    await fs.promises.writeFile(
      path.join(tmpDir, "export-info.json"),
      JSON.stringify({ exportedAt: new Date().toISOString() }, null, 2) + "\n",
      "utf8",
    );

    return {
      notes: rows.length,
      attachments: {
        copied: attachments.size,
        missing: Array.from(missing).sort(),
      },
    };
  };
}
