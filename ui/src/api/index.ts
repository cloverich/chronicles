import { Documents, SaveRequest } from "./documents";
import { Journals } from "./journals";
import { createDb } from "./database";
import Handlers from "./handlers";
import { server } from "./server";

const dbfile = process.argv[2] || "./pragma.db";
console.log("using db file", dbfile);

async function init() {
  const db = createDb(dbfile); // todo: how to decide if re-schema!?
  const journals = await Journals.create(db);
  const documents = new Documents(db, journals);
  return { documents, journals };
}

// init().then(() => console.log("done?"), console.error);

// (async () => {
//   const { documents, journals } = await init();
//   console.log(documents.search({ journals: ["chronicles"] }));
// })();
export default async function initServer() {
  await server(new Handlers(await init()));
}

(async () => {
  await initServer();
})();
