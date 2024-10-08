// This importer is a legacy of the prior file-based format, which IIRC was something like:

// /my_journal
//   2024/
//     /04
//       /01
// # etc
// Because I did not use front-matter, and because the ctime / mtime could be changed by bulk file moves / zip /
// cloud sync, I relied on the filename for the date of the note. I think it makes sense to leave this until
// I'm satisfied with the final format of Chronicles data, and especially until I introduce markdown importers.
//
//
// import fs from "fs";
// import { DateTime } from "luxon";
// import path from "path";
// import { stringToMdast } from "../../markdown";
// import { Files } from "../files";
// import { shouldIndexDay } from "./legacy/indexer";

// import { create } from "../client";
// const client = create();

// async function findOrCreate(name: string) {
//   const journals = await client.journals.list();
//   // if (journals.includes)
//   const existing = journals.find((j) => j.name === name);
//   if (existing) return existing;

//   return await client.journals.create({ name });
// }

// // Copy pasta from shouldIndex and exported for my importChronicles script...
// function dateFromPrevalidatedFilepath(filepath: string) {
//   const { ext, name } = path.parse(filepath);
//   if (ext !== ".md") return false;
//   if (name.startsWith(".")) return false;

//   // NOTE: This manages to respect the timezone, so if I pull 2020-05-01,
//   // turn it into a date, then stringify it, it gives me a 5 hour (CDT) offset.
//   // Filename (without extension) must be a valid date
//   const parsedDate = DateTime.fromISO(name);
//   if (name !== parsedDate.toISODate()) return false;

//   return parsedDate;
// }

// // Import documents from my old file based system, which used markdown files
// // in a one note per day system: /my-journal/2020/05/01/2020-05-01.md
// export async function importChronicles(notesDir: string) {
//   // await new Promise((res) => setTimeout(res, 2000));
//   // list all journals in my notes directory
//   const journals = fs
//     .readdirSync(notesDir)
//     // excludes '.DS_Store' and other misc. directories
//     .filter((folder) => !folder.startsWith("."));

//   // walk journals one by one
//   for (const journal of journals) {
//     const jourrnalModel = await findOrCreate(journal);

//     for await (const file of Files.walk(
//       path.join(notesDir, journal),
//       shouldIndexDay,
//     )) {
//       const parsed = await loadDocument(file.path);
//       if (parsed.mdast.type !== "root") throw new Error("oh my");

//       for await (const document of splitOnTitle(parsed.contents)) {
//         // skip empty documents...
//         if (!document.content.length) continue;

//         const date = dateFromPrevalidatedFilepath(file.path);
//         if (!date) throw new Error(`expected valid date for ${file.path}`);

//         // todo: consider adding a `date` field, and using that as the definitive date
//         // then createdAt and updatedAt could maintain "When was this document created"
//         // and make back-dating a bit more sensible...
//         const doc = await client.documents.save({
//           journal: jourrnalModel!.id,
//           createdAt: date.toISO()!,
//           updatedAt: date.toISO()!,
//           content: document.content,
//           title: document.title,
//           tags: [], // todo
//         });
//         console.log("created", doc.id);
//       }
//     }
//   }
// }

// async function loadDocument(filepath: string) {
//   // date?
//   const contents = await Files.read(filepath);
//   return {
//     contents: contents,
//     mdast: stringToMdast(contents),
//   };
// }

// // Split a document into multiple documents by presence of a top-level
// // markdown heading, i.e. "# This is a heading"
// function splitOnTitle(
//   content: string,
// ): Array<{ title: string; content: string }> {
//   const lines = content.split("\n");

//   // Clear a few edge cases to simplify the rest of the implementation:
//   // Empty -- return empty array
//   // One document with only a title -- return empty array
//   // One document with only one line -- return one document
//   if (lines.length === 0) return [];

//   if (lines.length === 1) {
//     // Drop documents that have only a title and no content
//     if (lines[0].startsWith("# ")) return [];
//     return [{ title: "", content: lines[0] }];
//   }

//   function makeDocument(lines: string[]) {
//     const hasTitle = lines[0].startsWith("# ");
//     const document = {
//       title: hasTitle ? lines[0].slice(2) : "",
//       content: hasTitle ? lines.slice(1).join("\n") : lines.join("\n"),
//     };

//     document.content = document.content.trim();
//     return document;
//   }

//   let nextDocumentLines: string[] = [];
//   const documents: Array<{ title: string; content: string }> = [];

//   for (const line of lines) {
//     if (line.startsWith("# ") && nextDocumentLines.length > 0) {
//       // append existing lines as document, then create a new one
//       documents.push(makeDocument(nextDocumentLines));
//       nextDocumentLines = [line];
//     } else {
//       nextDocumentLines.push(line);
//     }
//   }

//   // clear the remaining buffered lines
//   if (nextDocumentLines.length) {
//     documents.push(makeDocument(nextDocumentLines));
//   }

//   return documents;
// }

// // Now that I import stuff that uses electron uhh...
// // this must be called from an electron process...
// // ... but I also use typescript...
// // call from renderer? lmao.
// // importChronicles().then(
// //   () => {
// //     process.exit(0);
// //   },
// //   (err) => {
// //     console.error(err);
// //     process.exit(1);
// //   }
// // );
