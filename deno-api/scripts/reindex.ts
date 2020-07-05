import { createDb, recreateSchema } from "../documents/db.ts";
import { Journals } from "../documents/Journals.ts";
const journals = await Journals.create(createDb(Deno.cwd() + "/pragma.db"));
await journals.reindex();
