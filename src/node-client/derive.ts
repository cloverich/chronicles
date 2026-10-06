import { eq, sql } from "drizzle-orm";
import type {
  BetterSQLite3Database,
  BetterSQLiteTransaction,
} from "drizzle-orm/better-sqlite3";

import {
  parseMarkdown,
  selectDistinctImageUrls,
  selectNoteLinks,
} from "../markdown";
import { parseNoteLink } from "../markdown/noteLinks";
import * as schema from "./schema";
import { documentLinks, imageLinks } from "./schema";

/** A sync better-sqlite3 transaction, or the db handle itself (sync transactions accept either). */
export type Trx =
  | BetterSQLite3Database<typeof schema>
  | BetterSQLiteTransaction<typeof schema, any>;

export interface DerivableDocument {
  id: string;
  title: string | null | undefined;
  content: string;
}

export interface DerivedData {
  /** Distinct note-link targets, in document order. */
  noteLinks: { targetId: string }[];
  /** Distinct image destinations, in document order. */
  imageLinks: string[];
  fts: { title: string; content: string };
}

/**
 * Pure derivation from a note's content; spec: `spec/derive.md`, gated by
 * `spec/vectors/derive`.
 */
export function deriveData(doc: Omit<DerivableDocument, "id">): DerivedData {
  const mdast = parseMarkdown(doc.content);

  const seenTargets = new Set<string>();
  const noteLinks: DerivedData["noteLinks"] = [];
  for (const link of selectNoteLinks(mdast)) {
    const parsed = parseNoteLink(link.url);
    if (!parsed || seenTargets.has(parsed.noteId)) continue;
    seenTargets.add(parsed.noteId);
    noteLinks.push({ targetId: parsed.noteId });
  }

  return {
    noteLinks,
    imageLinks: selectDistinctImageUrls(mdast),
    fts: { title: doc.title ?? "", content: doc.content },
  };
}

/**
 * Regenerates the rows derived from a document's content: document_links,
 * image_links, documents_fts. Runs inside the caller's transaction.
 */
export function derive(trx: Trx, doc: DerivableDocument): void {
  const data = deriveData(doc);

  trx.delete(documentLinks).where(eq(documentLinks.documentId, doc.id)).run();
  if (data.noteLinks.length > 0) {
    trx
      .insert(documentLinks)
      .values(data.noteLinks.map((l) => ({ documentId: doc.id, ...l })))
      .run();
  }

  trx.delete(imageLinks).where(eq(imageLinks.documentId, doc.id)).run();
  if (data.imageLinks.length > 0) {
    trx
      .insert(imageLinks)
      .values(
        data.imageLinks.map((imagePath) => ({ documentId: doc.id, imagePath })),
      )
      .run();
  }

  trx.run(sql`DELETE FROM documents_fts WHERE id = ${doc.id}`);
  trx.run(
    sql`INSERT INTO documents_fts (id, title, content) VALUES (${doc.id}, ${data.fts.title}, ${data.fts.content})`,
  );
}
