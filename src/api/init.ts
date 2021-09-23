import { server } from "./server";
import handlers from "./handlers/index";

// todo: these should all be removed when the legacy cleanup happens, but
// logging the database url assumed by the backend is critical for debugging
// end user issues
// const dbfile = process.argv[2] || "./pragma.db";
// console.log("using db file", dbfile);

// async function init() {
//   const db = createDb(dbfile, process.env.CHRONICLES_RESCHEMA != null);
//   const journals = await Journals.create(db);
//   const documents = new Documents(db, journals);
//   return { documents, journals };
// }

export default async function initServer() {
  return await server(handlers());
}
