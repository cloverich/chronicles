// This script was mostly used as-is to migrate local documents from the prior
// id version (cuid) to uuidv7, primarily to allow me to set older ids with
// older timestamps, and get a global sort-order that's consistent between
// the id and createdAt.
//
// NOTE: This script won't actually run here, because the databse is compiled
// against a target electron version, rather than the local node version. So
// I run it in the preload/client/index.ts file; keeping here for reference.
import Knex from "knex";
import { V7Generator } from "uuidv7";

const knex = Knex({
  client: "better-sqlite3",
  connection: {
    filename: "/Users/my/sqlite3database.db",
  },
});

function uuidV7FromTimestamp(ts: string) {
  const timestamp = new Date(ts).getTime();
  const g = new V7Generator();
  return g.generateOrResetCore(timestamp, 10000).toString();
}

async function validateSortOrder() {
  const journals = await knex("journals");

  // All documents sorted by date; sort is for fudging the timestamp (see below)
  const documents = await knex("documents")
    .select("id", "title", "createdAt", "journalId")
    .orderBy("createdAt", "desc");

  // Adding a UUIDv7 based on createdAt to each document
  documents.forEach((doc, idx) => {
    // Several documnts have precisely the same createdAt timestamp; this was from when
    // I was defaulting createdAt to startOf('day') for all documents, which is no
    // longer the case.
    const timestamp = new Date(doc.createdAt).getTime();
    const offset = idx * 20000;
    doc.createdAt = new Date(timestamp + offset).toISOString();
    doc.uuid = uuidV7FromTimestamp(doc.createdAt);
  });

  for (const doc of documents) {
    // For now only updating id, not createdAt, b/c I can't definitely say
    // I want to discard the old createdAt value. This is only relevant for
    // my personal documents anyways.
    await knex("documents").where({ id: doc.id }).update({ id: doc.uuid });
  }

  // now update journals
  for (const j of journals) {
    const uuid = uuidV7FromTimestamp(j.createdAt);
    await knex("journals").where({ id: j.id }).update({ id: uuid });
  }
}

validateSortOrder();
