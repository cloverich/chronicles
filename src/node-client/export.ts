import crypto from "crypto";
import { eq } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import { parseNoteLink } from "../markdown/noteLinks";
import { rewriteUrls } from "../markdown/rewriteUrls";
import { createId } from "../preload/client/util";
import {
  compareCodePoints,
  noteRevision,
  serializeNote,
} from "./canonical-note";
import {
  assignJournalDirs,
  encodeLinkSegment,
  EXPORT_FORMAT_VERSION,
} from "./export-layout";
import { isSameOrInside, pathExists } from "./fs-guards";
import * as schema from "./schema";
import { documents, documentTags, imageLinks, journals } from "./schema";

export interface ExportReport {
  destDir: string;
  notes: number;
  attachments: { copied: number; missing: string[] };
}

export interface ManifestJournal {
  id: string;
  name: string;
  dir: string;
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
  byteSize: number;
}

export interface Manifest {
  formatVersion: string;
  journals: ManifestJournal[];
  notes: ManifestNote[];
  attachments: ManifestAttachment[];
}

const ATTACHMENT_PREFIX = "../_attachments/";

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

  private writeExport = async (
    tmpDir: string,
  ): Promise<Omit<ExportReport, "destDir">> => {
    const notesAttachmentsDir = path.join(this.notesDir, "_attachments");

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
    const missingBasenames = new Set<string>();

    for (const row of rows) {
      const tagRows = await this.db
        .select({ tag: documentTags.tag })
        .from(documentTags)
        .where(eq(documentTags.documentId, row.id));

      const content = rewriteUrls(row.content, (url) => {
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
        revision: noteRevision(fileContents),
      });

      // ---- attachments referenced by this note ----
      const imageRows = await this.db
        .select({ imagePath: imageLinks.imagePath })
        .from(imageLinks)
        .where(eq(imageLinks.documentId, row.id));

      for (const { imagePath } of imageRows) {
        if (!imagePath.startsWith(ATTACHMENT_PREFIX)) continue;
        const basename = path.basename(imagePath);
        const relAttachment = `_attachments/${basename}`;
        if (attachments.has(relAttachment) || missingBasenames.has(basename)) {
          continue;
        }

        const sourcePath = path.join(notesAttachmentsDir, basename);
        if (!(await pathExists(sourcePath))) {
          missingBasenames.add(basename);
          continue;
        }

        const bytes = await fs.promises.readFile(sourcePath);
        await fs.promises.mkdir(path.join(tmpDir, "_attachments"), {
          recursive: true,
        });
        await fs.promises.writeFile(path.join(tmpDir, relAttachment), bytes);
        attachments.set(relAttachment, {
          path: relAttachment,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
          byteSize: bytes.byteLength,
        });
      }
    }

    const manifest: Manifest = {
      formatVersion: EXPORT_FORMAT_VERSION,
      journals: journalRows
        .map((j) => ({ id: j.id, name: j.name, dir: dirsByName.get(j.name)! }))
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
        missing: Array.from(missingBasenames).sort(),
      },
    };
  };
}
