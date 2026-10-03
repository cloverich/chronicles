import { eq, sql } from "drizzle-orm";
import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import {
  attachmentPoolPath,
  parseAttachmentUrl,
} from "../markdown/attachmentRefs";
import { parseNoteLink, toStoredNoteLink } from "../markdown/noteLinks";
import { rewriteUrls, type UrlNode } from "../markdown/rewriteUrls";
import { createId } from "../preload/client/util";
import { readChroniclesTree } from "./chronicles-tree";
import type { IDocumentsClient } from "./documents";
import { stripColumnOwnedKeys } from "./documents";
import type { Manifest } from "./export";
import { decodeLinkSegment, EXPORT_FORMAT_MAJOR } from "./export-layout";
import type { IFilesClientForImport } from "./files-import-resolver";
import { isSameOrInside } from "./fs-guards";
import { findJournalIgnoringCase } from "./journals";
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

function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url; // malformed escape sequence
  }
}

/**
 * Whether a destination refers to a local attachment: any local image, any
 * link into `_attachments/`, or an already content-addressed reference.
 */
function isAttachmentRef(url: string, node: UrlNode): boolean {
  if (/^(https?:|data:|mailto:)/i.test(url)) return false;
  if (parseNoteLink(url)) return false;
  if (parseAttachmentUrl(url)) return true;
  return node.type === "image" || url.includes("_attachments/");
}

/**
 * Find an attachment's file in the import tree and store it
 * content-addressed. Returns the stored reference, or undefined when the file
 * can't be found (the caller leaves the reference as it was).
 */
async function importAttachment(
  url: string,
  notePath: string,
  importDir: string,
  files: IFilesClientForImport,
  report: ChroniclesImportReport,
  missing: Set<string>,
): Promise<string | undefined> {
  const stored = parseAttachmentUrl(url);
  const relative = stored
    ? `_attachments/${attachmentPoolPath(stored.sha256, stored.ext)}`
    : safeDecode(url.replace(/^chronicles:\/\//, "").split("?")[0] || "");
  const basename = path.basename(relative);

  const candidates = [
    path.resolve(path.dirname(notePath), relative),
    path.resolve(importDir, relative),
    path.join(importDir, "_attachments", basename),
  ].filter((c) => isSameOrInside(c, importDir));

  const sourcePath = candidates.find((c) => fs.existsSync(c));
  if (!sourcePath) {
    missing.add(basename);
    return undefined;
  }

  const result = await files.attachments.putFile(sourcePath);
  report.attachments[result.existed ? "existing" : "copied"]++;
  return result.url;
}

/**
 * Read `manifest.json` when the tree is a v2+ export. Legacy (v1) exports and
 * plain notes directories have no usable manifest and import by directory
 * name. An unknown major version is rejected rather than guessed at.
 */
async function readManifest(importDir: string): Promise<Manifest | null> {
  const manifestPath = path.join(importDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const raw = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  if (raw?.formatVersion == null) return null; // v1: `version: 1`
  const major = parseInt(String(raw.formatVersion).split(".")[0], 10);
  if (major !== EXPORT_FORMAT_MAJOR) {
    throw new Error(
      `[IMPORT_UNSUPPORTED_FORMAT] Export format ${raw.formatVersion} is not supported (expected ${EXPORT_FORMAT_MAJOR}.x)`,
    );
  }
  return raw as Manifest;
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

  const manifest = await readManifest(importDir);
  const journalByDir = new Map(
    (manifest?.journals ?? []).map((j) => [j.dir, j]),
  );

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

  // Match by journal id first, then by name ignoring case (a tree directory
  // "Features" merges into an existing "features" journal). An existing
  // same-name journal with no notes adopts the imported id, so a fresh
  // library's default journal doesn't fork the identity of an exported one.
  // Returns the stored name.
  const ensuredJournals = new Map<string, string>();
  const ensureJournal = async (
    journalName: string,
    journalId?: string,
    archivedAt: string | null = null,
  ): Promise<string> => {
    const cacheKey = journalId ?? journalName;
    const cached = ensuredJournals.get(cacheKey);
    if (cached) return cached;

    const resolved = db.transaction((trx) => {
      if (journalId) {
        const [byId] = trx
          .select({ name: schema.journals.name })
          .from(schema.journals)
          .where(eq(schema.journals.id, journalId))
          .all();
        if (byId) return byId.name;
      }

      const existing = findJournalIgnoringCase(trx, journalName);
      if (existing) {
        if (journalId) {
          const [{ count }] = trx
            .select({ count: sql<number>`count(*)` })
            .from(schema.documents)
            .innerJoin(
              schema.journals,
              eq(schema.documents.journalId, schema.journals.id),
            )
            .where(eq(schema.journals.name, existing))
            .all();
          if (count === 0) {
            trx
              .update(schema.journals)
              .set({ id: journalId })
              .where(eq(schema.journals.name, existing))
              .run();
          }
        }
        return existing;
      }

      const timestamp = new Date().toISOString();
      trx
        .insert(schema.journals)
        .values({
          id: journalId ?? createId(),
          name: journalName,
          createdAt: timestamp,
          updatedAt: timestamp,
          archivedAt,
        })
        .run();
      report.journalsCreated.push(journalName);
      return journalName;
    });
    ensuredJournals.set(cacheKey, resolved);
    return resolved;
  };

  for (const j of manifest?.journals ?? []) {
    await ensureJournal(j.name, j.id, j.archivedAt ?? null);
  }

  const { notes, report: treeReport } = readChroniclesTree(importDir);

  for await (const note of notes) {
    try {
      if (note.frontMatter.id != null && note.frontMatter.id !== note.id) {
        throw new Error(
          `frontmatter id ${note.frontMatter.id} does not match filename`,
        );
      }
      const manifestJournal = journalByDir.get(note.journal);
      const journal = manifestJournal
        ? await ensureJournal(manifestJournal.name, manifestJournal.id)
        : await ensureJournal(note.journal);

      const attachmentUrls = new Map<string, string | undefined>();
      rewriteUrls(note.body, (url, node) => {
        if (isAttachmentRef(url, node)) attachmentUrls.set(url, undefined);
        return undefined;
      });
      for (const url of attachmentUrls.keys()) {
        attachmentUrls.set(
          url,
          await importAttachment(
            url,
            note.path,
            importDir,
            files,
            report,
            missingAttachments,
          ),
        );
      }

      const content = rewriteUrls(note.body, (url) => {
        if (attachmentUrls.has(url)) return attachmentUrls.get(url);
        return toStoredNoteLink(decodeLinkSegment(url));
      }).markdown;

      const userKeys = stripColumnOwnedKeys(note.frontMatter);

      const result = await documents.importDocument(
        {
          id: note.id,
          journal,
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
