import { eq } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import { mdastToString, selectImageLinks } from "../markdown";
import { createId } from "../preload/client/util";
import { readChroniclesTree } from "./chronicles-tree";
import type { IDocumentsClient } from "./documents";
import { stripColumnOwnedKeys } from "./documents";
import type { IFilesClientForImport } from "./files-import-resolver";
import type { IPreferencesClient } from "./preferences";
import * as schema from "./schema";

export interface ChroniclesImportOptions {
  onConflict: "skip" | "replace";
}

export interface ChroniclesImportReport {
  created: number;
  skipped: number;
  replaced: number;
  errored: { id: string; path: string; error: string }[];
  /** id → journals it also appeared in (beyond the first, imported, copy) */
  duplicates: Record<string, string[]>;
  attachments: { copied: number; existing: number; missing: string[] };
  journalsCreated: string[];
}

export interface ChroniclesImportDeps {
  db: BetterSQLite3Database<typeof schema>;
  documents: IDocumentsClient;
  files: IFilesClientForImport;
  preferences: IPreferencesClient;
  notesDir: string;
}

const DEFAULT_OPTS: ChroniclesImportOptions = { onConflict: "skip" };

/** Strip a query string, decode percent-escapes, then return the basename of a (possibly relative) image URL. */
function basenameOf(url: string): string {
  const withoutQuery = url.split("?")[0] || "";
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // malformed escape sequence — fall back to the raw string
  }
  return path.basename(decoded);
}

/** Remote and inline images are left untouched; only local paths are attachments. */
function isExternalImageUrl(url: string): boolean {
  return /^(https?:|data:)/i.test(url);
}

/** Strip a leading `chronicles://` prefix, if present. */
function normalizeImageUrl(url: string): string {
  if (url.startsWith("chronicles://")) {
    return url.slice("chronicles://".length);
  }
  return url;
}

/**
 * Resolve an image link's source file and copy it (if not already present)
 * into `<notesDir>/_attachments/<basename>`, preserving the filename.
 * Always returns the canonical `../_attachments/<basename>` URL, even when
 * the source file cannot be found (the caller records it as missing).
 */
async function resolveAndCopyImage(
  url: string,
  notePath: string,
  importDir: string,
  attachmentsDestDir: string,
  files: IFilesClientForImport,
  report: ChroniclesImportReport,
  missing: Set<string>,
): Promise<string> {
  const normalized = normalizeImageUrl(url);
  const basename = basenameOf(normalized);
  const canonicalUrl = path.posix.join("..", "_attachments", basename);

  let decodedNormalized = normalized;
  try {
    decodedNormalized = decodeURIComponent(normalized);
  } catch {
    // malformed escape sequence — fall back to the raw string
  }

  const candidates = [
    path.join(importDir, "_attachments", basename),
    path.resolve(path.dirname(notePath), decodedNormalized),
    path.resolve(importDir, decodedNormalized),
  ];

  let sourcePath: string | undefined;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      sourcePath = candidate;
      break;
    }
  }

  if (!sourcePath) {
    missing.add(basename);
    return canonicalUrl;
  }

  const destPath = path.join(attachmentsDestDir, basename);
  if (fs.existsSync(destPath)) {
    report.attachments.existing++;
  } else {
    await files.copyFile(sourcePath, destPath);
    report.attachments.copied++;
  }

  return canonicalUrl;
}

/**
 * Imports a Chronicles-tree export (`<importDir>/<journal>/<id>.md`,
 * frontmatter + a sibling `_attachments/`) into the database, preserving
 * ids, timestamps, journal, tags, note links, and attachments. Re-import of
 * an existing id is governed by `opts.onConflict` — never inferred.
 */
export async function importChroniclesTree(
  deps: ChroniclesImportDeps,
  importDir: string,
  opts: ChroniclesImportOptions = DEFAULT_OPTS,
): Promise<ChroniclesImportReport> {
  const { db, documents, files, preferences, notesDir } = deps;
  importDir = path.resolve(importDir);

  const report: ChroniclesImportReport = {
    created: 0,
    skipped: 0,
    replaced: 0,
    errored: [],
    duplicates: {},
    attachments: { copied: 0, existing: 0, missing: [] },
    journalsCreated: [],
  };
  const missingAttachments = new Set<string>();

  const importerId = createId();
  await db.insert(schema.imports).values({
    id: importerId,
    status: "pending",
    importDir,
  });

  const attachmentsDestDir = path.join(notesDir, "_attachments");
  await fs.promises.mkdir(attachmentsDestDir, { recursive: true });

  const ensuredJournals = new Set<string>();
  const ensureJournal = async (journalName: string) => {
    if (ensuredJournals.has(journalName)) return;
    ensuredJournals.add(journalName);

    const timestamp = new Date().toISOString();
    const result = db
      .insert(schema.journals)
      .values({ name: journalName, createdAt: timestamp, updatedAt: timestamp })
      .onConflictDoNothing()
      .run();

    if (result.changes > 0) {
      report.journalsCreated.push(journalName);
    }

    const archived: Record<string, boolean> =
      (await preferences.get("archivedJournals")) ?? {};
    if (!(journalName in archived)) {
      await preferences.set(`archivedJournals.${journalName}`, false);
    }
  };

  const { notes, report: treeReport } = readChroniclesTree(importDir);

  for await (const note of notes) {
    try {
      await ensureJournal(note.journal);

      const images = selectImageLinks(note.mdast);
      for (const image of images) {
        if (isExternalImageUrl(image.url)) continue;
        image.url = await resolveAndCopyImage(
          image.url,
          note.path,
          importDir,
          attachmentsDestDir,
          files,
          report,
          missingAttachments,
        );
      }

      const content = mdastToString(note.mdast);
      const userKeys = stripColumnOwnedKeys(note.frontMatter);

      const result = await documents.importDocument(
        {
          id: note.id,
          journal: note.journal,
          title: note.frontMatter.title,
          createdAt: note.frontMatter.createdAt,
          updatedAt: note.frontMatter.updatedAt,
          tags: note.frontMatter.tags || [],
          content,
          frontMatter: userKeys,
        },
        opts,
      );

      report[result]++;
    } catch (err) {
      report.errored.push({
        id: note.id,
        path: note.path,
        error: (err as Error).message || String(err),
      });
      console.error(
        "[importer-chronicles] Error importing note",
        note.path,
        err,
      );
    }
  }

  for (const [id, journals] of treeReport().duplicates) {
    report.duplicates[id] = journals;
  }
  report.attachments.missing = Array.from(missingAttachments);

  await db
    .update(schema.imports)
    .set({ status: "complete" })
    .where(eq(schema.imports.id, importerId));

  return report;
}
