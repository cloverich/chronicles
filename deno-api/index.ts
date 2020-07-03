import { createDb } from "./documents/db.ts";
import { Journals } from "./documents/Journals.ts";

const db = createDb(Deno.env.get("PRAGMA_DB"), true);
const journals = new Journals(db);
journals.add({
  name: "Chronicles",
  url: "/Users/cloverich/Google Drive/notes/chronicles",
});
