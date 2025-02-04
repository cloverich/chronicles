import { assert } from "chai";
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
  test,
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

// rudiemntary test runner for importer tests that require a database
// and electron environment.
// todo: Refactor to run as a proper test suite and via CI (requires electron)
export async function runTests() {
  await cleanup();
  try {
    const { client, testdir, knex } = await setup();
    await generateFileStubs(binaryFileStubs);
    await testNotion(client, testdir, knex);
  } finally {
    await cleanup();
  }
}

// rudiemntary tests for importing from an exported Notion directory
async function testNotion(client: Client, testdir: string, knex: Knex) {
  await test("preferences is reset to defaults before starting", async () => {
    const archivedStates = await client.preferences.get("ARCHIVED_JOURNALS");
    assert.deepEqual(archivedStates, {});
  });

  const notionImportDir = path.join(testdir, "notion");
  await client.importer.import(
    path.resolve(notionImportDir),
    SourceType.Notion,
  );

  await test("imports six files", async () => {
    const importedFiles = await knex("import_files").select("*");
    assert.lengthOf(importedFiles, 6, "Expected to find six imported files");
    importedFiles.forEach((file) => {
      if (file.status !== "complete") {
        throw new Error(
          `File import failed with status ${file.status}: ${file.sourcePathResolved} (error, if any): ${file.error}`,
        );
      }
    });
  });

  await test("imports two notes", async () => {
    const importedNotes = await knex("import_notes").select("*");
    assert.lengthOf(importedNotes, 2, "Expected to find two imported notes");
    importedNotes.forEach((note) => {
      if (note.status !== "note_created") {
        throw new Error(
          `Note import failed with status ${note.status}: ${note.sourcePathResolved} (error, if any): ${note.error}`,
        );
      }
    });
  });

  await test("it creates archived entries for each journal", async () => {
    const archivedStates = await client.preferences.get("ARCHIVED_JOURNALS");
    assert.deepEqual(archivedStates, {
      Documents: false,
      notion: false,
    });
  });

  // todo: break up better; more methodical and complete
  await test("imported documents (notion) are linked and have expected front matter", async () => {
    const portlandDrive = await findByTitle(client, "The Portland Drive");

    // todo: control timezone in importer so here and CI can match
    assert.equal(
      portlandDrive.frontMatter.createdAt.slice(0, 7),
      "2022-05",
      'Expected document creation date to be "2022-05"',
    );

    assert.equal(
      portlandDrive.journal,
      "Documents",
      'Expected "Portland Drive" document to be in journal to be "Documents"',
    );

    assert.deepInclude(portlandDrive.frontMatter, {
      title: "The Portland Drive",
      tags: ["review"],

      // maintains original front matter
      "Created By": "chris",
      published: "No",
    });

    const roadTrip = await findByTitle(client, "Road Trip");

    const documentLinks = await knex("document_links").where({
      documentId: portlandDrive.id,
      targetId: roadTrip.id,
    });

    assert.lengthOf(
      documentLinks,
      1,
      'Expected "Portland Drive" to link to "Road Trip"',
    );

    // ensure document link is updated as expected
    assert.include(
      portlandDrive.content,
      `[West coast road trip 2022](../notion/${roadTrip.id}.md)`,
      'Expected Portland Drive doc to include updated link to "Road Trip"',
    );
  });

  await test("import tables after second import", async () => {
    const otherDir = path.join(testdir, "other");
    await client.importer.import(path.resolve(otherDir), SourceType.Other);

    // no new files
    const importedFiles = await knex("import_files").select("*");
    assert.lengthOf(importedFiles, 6, "Expected to find eight imported files");

    // two new notes
    const importedNotes = await knex("import_notes").select("*");
    assert.lengthOf(importedNotes, 4, "Expected to find two imported notes");
    importedNotes.forEach((note) => {
      if (note.status !== "note_created") {
        throw new Error(
          `Note import failed with status ${note.status}: ${note.sourcePathResolved} (error, if any): ${note.error}`,
        );
      }
    });
  });

  await test("imported documents (other) are linked and have expected front matter after second import", async () => {
    const doc1 = await findByTitle(client, "Document 1");
    const doc2 = await findByTitle(client, "Document 2");

    await test("document 1 has correct structure", async () => {
      assert.equal(
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

    await test("document 2 has correct front matter", async () => {
      assert.equal(
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

    await test("document links from Document 1 to Document 2", async () => {
      const documentLinks = await knex("document_links").where({
        documentId: doc1.id,
        targetId: doc2.id,
      });

      assert.lengthOf(
        documentLinks,
        1,
        'Expected tracked links from "Document 1" to "Document 2"',
      );

      // ensure document link is updated as expected
      assert.include(
        doc1.content,
        `[Document 2](../chronicles/${doc2.id}.md)`,
        'Expected Document 1 doc to include updated link to "Document 2"',
      );
    });

    await test("document links from Document 2 to Document 1", async () => {
      const documentLinks = await knex("document_links").where({
        documentId: doc2.id,
        targetId: doc1.id,
      });

      assert.lengthOf(
        documentLinks,
        1,
        'Expected tracked links from "Document 2" to "Document 1"',
      );

      // ensure document link is updated as expected
      assert.include(
        doc2.content,
        `[Document 1](../chronicles/${doc1.id}.md)`,
        'Expected Document 2 doc to include updated link to "Document 1"',
      );
    });
  });
}
