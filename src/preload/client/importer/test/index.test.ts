import assert from "node:assert";
import { describe, test } from "node:test";
import { Knex } from "knex";
import path from "path";
import { SourceType } from "../SourceType";
import {
  Client,
  GenerateFileOptions,
  cleanup,
  findByTitle,
  generateFileStubs,
  setup,
} from "./util";

// files referenced by markdown notes in the test directory
const binaryFileStubs: GenerateFileOptions[] = [
  {
    filePath:
      "./notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/Screen_Shot_2022-05-28_at_7.06.54_AM.png",
    fileType: "png",
  },
  {
    filePath:
      "./notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/Screen_Shot_2022-05-28_at_7.07.08_AM.png",
    fileType: "png",
  },
  {
    filePath:
      "./notion/Documents c3ceaee48e24410f90a075fb72681991/The Portland Drive 6cc3eb96a4b84f0d9a80d9473379248c/IMG_1988.jpg",
    fileType: "jpg",
  },
  {
    filePath:
      "./notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_2.24.52_PM.png",
    fileType: "png",
  },
  {
    filePath:
      "./notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_3.43.30_PM.png",
    fileType: "png",
  },
  {
    filePath:
      "./notion/Road Trip e3b4875d74ca4fc4a2be5d7759acc07c/Screen_Shot_2022-04-07_at_2.23.46_PM.png",
    fileType: "png",
  },
];

describe("Importer Tests", () => {
  let client: Client;
  let testdir: string;
  let knex: Knex;

  test("setup and cleanup", async () => {
    await cleanup();
    const setupResult = await setup();
    client = setupResult.client;
    testdir = setupResult.testdir;
    knex = setupResult.knex;
    await generateFileStubs(binaryFileStubs);
  });

  test("preferences is reset to defaults before starting", async () => {
    const archivedStates = await client.preferences.get("archivedJournals");
    assert.deepEqual(archivedStates, {});
  });

  test("imports Notion files", async () => {
    const notionImportDir = path.join(testdir, "notion");
    await client.importer.import(
      path.resolve(notionImportDir),
      SourceType.Notion,
    );
  });

  test("imports six files", async () => {
    const importedFiles = await knex("import_files").select("*");
    assert.strictEqual(importedFiles.length, 6, "Expected to find six imported files");
    importedFiles.forEach((file) => {
      if (file.status !== "complete") {
        throw new Error(
          `File import failed with status ${file.status}: ${file.sourcePathResolved} (error, if any): ${file.error}`,
        );
      }
    });
  });

  test("imports two notes", async () => {
    const importedNotes = await knex("import_notes").select("*");
    assert.strictEqual(importedNotes.length, 2, "Expected to find two imported notes");
    importedNotes.forEach((note) => {
      if (note.status !== "note_created") {
        throw new Error(
          `Note import failed with status ${note.status}: ${note.sourcePathResolved} (error, if any): ${note.error}`,
        );
      }
    });
  });

  test("it creates archived entries for each journal", async () => {
    const archivedStates = await client.preferences.get("archivedJournals");
    assert.deepEqual(archivedStates, {
      Documents: false,
      notion: false,
    });
  });

  test("imported documents (notion) are linked and have expected front matter", async () => {
    const portlandDrive = await findByTitle(client, "The Portland Drive");

    // todo: control timezone in importer so here and CI can match
    assert.strictEqual(
      portlandDrive.frontMatter.createdAt.slice(0, 7),
      "2022-05",
      'Expected document creation date to be "2022-05"',
    );

    assert.strictEqual(
      portlandDrive.journal,
      "Documents",
      'Expected "Portland Drive" document to be in journal to be "Documents"',
    );

    assert.deepEqual(portlandDrive.frontMatter, {
      title: "The Portland Drive",
      tags: ["review"],
      createdAt: portlandDrive.frontMatter.createdAt, // dynamic value
      updatedAt: portlandDrive.frontMatter.updatedAt, // dynamic value

      // maintains original front matter
      "Created By": "chris",
      published: "No",
    });

    const roadTrip = await findByTitle(client, "Road Trip");

    const documentLinks = await knex("document_links").where({
      documentId: portlandDrive.id,
      targetId: roadTrip.id,
    });

    assert.strictEqual(
      documentLinks.length,
      1,
      'Expected "Portland Drive" to link to "Road Trip"',
    );

    // ensure document link is updated as expected
    assert.ok(
      portlandDrive.content.includes(`[West coast road trip 2022](../notion/${roadTrip.id}.md)`),
      'Expected Portland Drive doc to include updated link to "Road Trip"',
    );
  });

  test("import tables after second import", async () => {
    const otherDir = path.join(testdir, "other");
    await client.importer.import(path.resolve(otherDir), SourceType.Other);

    // no new files
    const importedFiles = await knex("import_files").select("*");
    assert.strictEqual(importedFiles.length, 6, "Expected to find six imported files");

    // two new notes
    const importedNotes = await knex("import_notes").select("*");
    assert.strictEqual(importedNotes.length, 4, "Expected to find four imported notes");
    importedNotes.forEach((note) => {
      if (note.status !== "note_created") {
        throw new Error(
          `Note import failed with status ${note.status}: ${note.sourcePathResolved} (error, if any): ${note.error}`,
        );
      }
    });
  });

  describe("imported documents (other) are linked and have expected front matter after second import", () => {
    let doc1: any;
    let doc2: any;

    test("find documents", async () => {
      doc1 = await findByTitle(client, "Document 1");
      doc2 = await findByTitle(client, "Document 2");
    });

    test("document 1 has correct structure", async () => {
      assert.strictEqual(
        doc1.journal,
        "chronicles",
        'Expected "Document 1" to be in journal "chronicles"',
      );

      assert.deepEqual(doc1.frontMatter, {
        title: "Document 1",
        tags: ["devlog"],
        createdAt: "2024-11-08T14:17:11.337Z",
        updatedAt: "2024-11-23T19:45:56.621Z",
      });
    });

    test("document 2 has correct front matter", async () => {
      assert.strictEqual(
        doc2.journal,
        "chronicles",
        'Expected "Document 2" to be in journal "chronicles"',
      );

      assert.deepEqual(doc2.frontMatter, {
        title: "Document 2",
        tags: ["devlog", "chronicles", "customtag"],
        createdAt: "2024-11-09T14:46:36.190Z",
        updatedAt: "2024-11-22T17:13:39.227Z",
      });
    });

    test("document links from Document 1 to Document 2", async () => {
      const documentLinks = await knex("document_links").where({
        documentId: doc1.id,
        targetId: doc2.id,
      });

      assert.strictEqual(
        documentLinks.length,
        1,
        'Expected tracked links from "Document 1" to "Document 2"',
      );

      // ensure document link is updated as expected
      assert.ok(
        doc1.content.includes(`[Document 2](../chronicles/${doc2.id}.md)`),
        'Expected Document 1 doc to include updated link to "Document 2"',
      );
    });

    test("document links from Document 2 to Document 1", async () => {
      const documentLinks = await knex("document_links").where({
        documentId: doc2.id,
        targetId: doc1.id,
      });

      assert.strictEqual(
        documentLinks.length,
        1,
        'Expected tracked links from "Document 2" to "Document 1"',
      );

      // ensure document link is updated as expected
      assert.ok(
        doc2.content.includes(`[Document 1](../chronicles/${doc1.id}.md)`),
        'Expected Document 2 doc to include updated link to "Document 1"',
      );
    });
  });

  test("cleanup after tests", async () => {
    await cleanup();
  });
});