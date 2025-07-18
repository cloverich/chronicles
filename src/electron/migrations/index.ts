import DB from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// A hacky "migration" script after bailing on Prisma and realizing
// better-sqlite3 is not compatible with knex yet :|
// https://github.com/knex/knex/issues/4511
// todo: real migrations, backup database while migrating
export default function (dbUrl: string) {
  const db = DB(dbUrl);

  try {
    // TODO: Can it be pulled in as a dependency with a loader!?
    // https://esbuild.github.io/content-types/#external-file
    // note: migration file(s) is co-located in this folder, but the entire main process is bundled and run from a different
    // location (project root), so this needs to reconstruct __this__ directory :confusing:
    const migration1 = fs.readFileSync(
      path.join(__dirname, "electron/migrations/20211005142122.sql"),
      "utf8",
    );
    db.exec(migration1);
  } catch (err) {
    console.error("Error running migrations!", err);
    throw err;
  }
}
