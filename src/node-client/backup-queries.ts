import type { DatabaseQueries } from "../backup/database";

/**
 * What the backup module needs to know about Chronicles' schema: a cheap
 * fingerprint of the content tables (latest update plus row counts, so
 * deletes register) and the counts recorded in each manifest.
 */
export const backupQueries: DatabaseQueries = {
  fingerprint: (db) => {
    const row = db
      .prepare(
        `SELECT
          (SELECT max(updatedAt) FROM documents) AS documentsUpdated,
          (SELECT count(*) FROM documents) AS documents,
          (SELECT max(updatedAt) FROM journals) AS journalsUpdated,
          (SELECT count(*) FROM journals) AS journals,
          (SELECT count(*) FROM document_tags) AS tags`,
      )
      .get() as Record<string, string | number | null>;
    return [
      `documents:${row.documents}@${row.documentsUpdated ?? ""}`,
      `journals:${row.journals}@${row.journalsUpdated ?? ""}`,
      `tags:${row.tags}`,
    ].join(";");
  },
  counts: (db) => {
    const count = (sql: string) => db.prepare(sql).pluck().get() as number;
    return {
      documents: count("SELECT count(*) FROM documents"),
      journals: count("SELECT count(*) FROM journals"),
      tags: count("SELECT count(DISTINCT tag) FROM document_tags"),
    };
  },
};
