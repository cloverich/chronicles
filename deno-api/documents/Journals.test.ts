// import { createDb } from "./db.ts";
// import { Journals } from "./Journals.ts";
// import {
//   assertEquals,
//   assertStringContains,
//   assertArrayContains,
//   assert,
// } from "https://deno.land/std@v0.59.0/testing/asserts.ts";

// // Simple name and function, compact form, but not configurable
// Deno.test("new createDb", async () => {
//   const db = createDb(":memory:", true);
//   // const j = new Journals(db);
//   // await j.add({
//   //   name: "Chronicles",
//   //   url: "/Users/cloverich/Google Drive/notes/chronicles",
//   // });
// });

// Deno.test("Journals.add", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });
// });

// Deno.test("Journals.add duplicate", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   const duplicateName = await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles-unique-url",
//   });

//   assertEquals(duplicateName, "Name already exists");

//   const duplicateUrl = await j.add({
//     name: "Chronicles-unique-name",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   assertEquals(duplicateUrl, "Url already exists");
// });

// Deno.test("ResultSet basic", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   assertEquals(await j.list(), [
//     {
//       name: "Chronicles",
//       url: "/Users/cloverich/Google Drive/notes/chronicles",
//     },
//   ]);
// });

// Deno.test("Journals.select", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   const rows = j.select(
//     "Select distinct journal, date from nodes order by date",
//     []
//   );

//   // well this is the stuipdest shit i've ever written
//   assertArrayContains(rows[0], ["Chronicles", "2016-01-11"]);
// });

// Deno.test("Journals.fetchDocument", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   const url = await j.fetchDocs("Chronicles", "2016-01-11");
//   assertStringContains(
//     url,
//     "Forgot to start a Chronicle to track my work on Chronicles."
//   );
// });

// Deno.test("selection types", async () => {
//   const db = createDb(":memory:", true);
//   const j = new Journals(db);
//   await j.add({
//     name: "Chronicles",
//     url: "/Users/cloverich/Google Drive/notes/chronicles",
//   });

//   // all journals
//   const basic = "Select distinct journal, date from nodes order by date";

//   // specific journal
//   const byJournal = [
//     "Select distinct journal, date from nodes where journal = ? order by date",
//     ["Chronicles"],
//   ];

//   //multiple journals
//   const byJournals = [
//     `Select distinct journal, date from nodes where journal in ('Chronicles', 'Foo') order by date`,
//     [],
//   ];

//   // search by heading
//   // return only code (or other node type)
//   // return

//   // multiple specific journals
//   const rows = j.select(
//     `Select distinct journal, date from nodes where journal in ('Chronicles', 'Foo') order by date`,
//     []
//   );

//   // well this is the stuipdest shit i've ever written
//   assertArrayContains(rows[0], ["Chronicles", "2016-01-11"]);
// });
