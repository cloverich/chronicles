import { Documents, SaveRequest } from "./documents";
import { Journals } from "./journals";
import { createDb } from "./database";
import Handlers from "./handlers";
import { server } from "./server";

const dbfile = process.argv[2] || "./pragma.db";
console.log("using db file", dbfile);

async function init() {
  const db = createDb(dbfile, process.env.CHRONICLES_RESCHEMA != null);
  const journals = await Journals.create(db);
  const documents = new Documents(db, journals);
  return { documents, journals };
}

export default async function initServer() {
  await server(new Handlers(await init()));
}

(async () => {
  await initServer();
})();
