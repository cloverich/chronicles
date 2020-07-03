import { createDb } from "./db.ts";
import { Journals } from "./Journals.ts";
import { DocsFinder } from "./Docs.ts";
import {
  assertEquals,
  assertStringContains,
  assertArrayContains,
  assert,
} from "https://deno.land/std@v0.59.0/testing/asserts.ts";

async function seed() {
  const db = createDb(":memory:", true);
  const journals = await Journals.create(db);
  await journals.add({
    name: "Chronicles",
    url: "/Users/cloverich/Google Drive/notes/chronicles",
  });
  await journals.add({
    name: "reading",
    url: "/Users/cloverich/Google Drive/notes/reading",
  });

  return { db, journals };
}

// Deno.test("search by journal", async () => {
//   const { db, journals } = await seed();
//   const finder = new DocsFinder(db, journals);
//   const results = await finder.search({
//     journals: ["Chronicles"],
//   });

//   assert(results.length > 0);
//   assert(results[0][0] === "Chronicles");

//   const resultsReading = await finder.search({
//     journals: ["reading"],
//   });

//   assert(resultsReading.length > 0);
//   assert(resultsReading[0][0] === "reading");

//   const resultsBoth = await finder.search({});
//   assertEquals(resultsBoth.length, resultsReading.length + results.length);
// });
