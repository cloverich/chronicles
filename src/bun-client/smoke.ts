/**
 * Smoke test CLI for the bun-client.
 *
 * Proves that createClient() works against a real filesystem path by exercising
 * the core read operations.
 *
 * Usage:
 *   DB_PATH=/tmp/test.db NOTES_DIR=/tmp/notes bun run src/bun-client/smoke.ts
 */

import { createClient } from "./factory";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Error: ${name} environment variable is required.`);
    console.error(
      "Usage: DB_PATH=/tmp/test.db NOTES_DIR=/tmp/notes bun run src/bun-client/smoke.ts",
    );
    process.exit(1);
  }
  return v;
}

const dbPath = requireEnv("DB_PATH");
const notesDir = requireEnv("NOTES_DIR");

console.log(`DB_PATH:   ${dbPath}`);
console.log(`NOTES_DIR: ${notesDir}`);
console.log("");

const client = await createClient({ dbPath, notesDir });

// Journals
const journals = await client.journals.list();
console.log(`Journals (${journals.length}):`);
for (const j of journals) {
  const status = j.archived ? " [archived]" : "";
  console.log(`  - ${j.name}${status}`);
}
if (journals.length === 0) {
  console.log("  (none)");
}
console.log("");

// Documents
const docsResult = await client.documents.search();
console.log(`Documents: ${docsResult.data.length}`);
console.log("");

// Tags
const tags = await client.tags.allWithCounts();
console.log(`Tags (${tags.length}):`);
for (const { tag, count } of tags) {
  console.log(`  - ${tag} (${count})`);
}
if (tags.length === 0) {
  console.log("  (none)");
}
console.log("");

console.log("Smoke test passed.");
