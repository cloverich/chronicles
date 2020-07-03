import { DB } from "../deps.ts";
import { createDb } from "./db.ts";
import { Journals } from "./Journals.ts";
import { assertEquals } from "https://deno.land/std@v0.59.0/testing/asserts.ts";
import { emptyDir } from "https://deno.land/std@v0.59.0/fs/mod.ts";
import { Indexer } from "./Indexer.ts";
import { parser } from "../md/index.ts";

const tmpdir1 = Deno.cwd() + "/tmp/data/reading";
const tmpdir2 = Deno.cwd() + "/tmp/data/reading2";
await emptyDir(tmpdir1);
await emptyDir(tmpdir2);

async function seed() {
  const db = createDb(":memory:", true);
  const journals = await Journals.create(db);
  await journals.add({
    name: "Chronicles",
    url: tmpdir1,
  });
  await journals.add({
    name: "reading",
    url: tmpdir2,
  });

  return { db, journals };
}

Deno.test("Indexer.update overwrites", async () => {
  const { db } = await seed();
  const indexer = new Indexer(db);

  const content1 = "# heading1";
  const content2 = "# heading2";
  await indexer.indexNode("reading", "2020-08-01", parser.parse(content1));
  const res = await mapRows(db);

  // 2 -- it parses to a heading node and a text node...
  // ... if i change the indexing strategy this would break...
  assertEquals(res.length, 2);
  assertEquals(res[0][0], "heading");
  assertEquals(res[0][1], content1);

  await indexer.update("reading", "2020-08-01", content2);
  const res2 = await mapRows(db);

  assertEquals(res2.length, 2);
  assertEquals(res2[0][0], "heading");
  assertEquals(res2[0][1], content2);
});

async function mapRows(db: DB) {
  const rows = await db.query("select type,contents  from nodes");
  let types = [];
  for (const [type, contents] of rows) {
    types.push([type, contents]);
  }
  rows.done();
  return types;
}
