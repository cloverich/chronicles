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

/**
 * Regenerates the rows derived from a document's content: document_links,
 * image_links, documents_fts. Runs inside the caller's transaction.
 */
export function derive(trx: Trx, doc: DerivableDocument): void {
  const mdast = parseMarkdown(doc.content);

  // ---- document_links ----
  trx.delete(documentLinks).where(eq(documentLinks.documentId, doc.id)).run();

  const noteLinks = selectNoteLinks(mdast);
  const seenTargets = new Set<string>();
  const linkRows: {
    documentId: string;
    targetId: string;
    targetJournal: string;
  }[] = [];
  for (const link of noteLinks) {
    const parsed = parseNoteLink(link.url);
    if (!parsed) continue;
    if (seenTargets.has(parsed.noteId)) continue;
    seenTargets.add(parsed.noteId);
    linkRows.push({
      documentId: doc.id,
      targetId: parsed.noteId,
      targetJournal: parsed.journalName,
    });
  }
  if (linkRows.length > 0) {
    trx.insert(documentLinks).values(linkRows).run();
  }

  // ---- image_links ----
  trx.delete(imageLinks).where(eq(imageLinks.documentId, doc.id)).run();

  const imageUrls = selectDistinctImageUrls(mdast);
  if (imageUrls.length > 0) {
    trx
      .insert(imageLinks)
      .values(
        imageUrls.map((imagePath) => ({
          documentId: doc.id,
          imagePath,
        })),
      )
      .run();
  }

  // ---- documents_fts ----
  trx.run(sql`DELETE FROM documents_fts WHERE id = ${doc.id}`);
  trx.run(
    sql`INSERT INTO documents_fts (id, title, content) VALUES (${doc.id}, ${doc.title ?? ""}, ${doc.content})`,
  );
}
