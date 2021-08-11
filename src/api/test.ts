import { describe, it, before } from "mocha";
import chai from "chai";
import { configure, Client, GetDocumentResponse } from "./client";
import initServer from "./init";
import ky from "ky-universal";

import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
const ajv = addFormats(new Ajv());
// https://github.com/ajv-validator/ajv-formats
// addFormats(ajv);

chai.use(
  require("chai-json-schema-ajv").create({
    ajv,
    verbose: true,
  })
);
const expect = chai.expect;

// https://ajv.js.org/api.html
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    id: {
      type: "string",
      title: "id",
      minLength: 25,
    },
    title: {
      type: ["string", "null"],
      title: "title",
      // https://github.com/prettier/prettier/issues/2789
      pattern: "^[\\w\\-._ ]+$",
    },
    createdAt: {
      type: "string",
      title: "createdAt",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      title: "updatedAt",
      format: "date-time",
    },
    journalId: {
      type: "string",
      title: "name",
      minLength: 25,
    },
  },
  required: ["id", "createdAt", "updatedAt", "journalId"],
};

const validate = ajv.compile(schema);

async function wrapValidation<T, Y>(
  innerFunc: Promise<T>
): Promise<T | { isError: true; title: string }> {
  try {
    return await innerFunc;
  } catch (err) {
    // https://github.com/sindresorhus/ky#hooksafterresponse
    if (err instanceof ky.HTTPError && err.response.status === 400) {
      const errResponse: { title: string } = await err.response.json();
      return { isError: true, ...errResponse };
    } else {
      throw err;
    }
  }
}

async function createIgnoreDuplicate(client: Client, name: string) {
  try {
    await client.journals.create({ name });
  } catch (err) {
    // Hmmm maybe client library should do all of this.
    // It could even be go like and return data | error?
    // where an error is a known error, giving a simpler way to
    // branch on them
    // todo: consider https://github.com/sindresorhus/ky#hooksafterresponse
    if (err instanceof ky.HTTPError && err.response.status === 400) {
      const errorName = await err.response.json();
      expect(errorName.title).to.equal("name must be unique");
    } else {
      throw err;
    }
  }
}

async function removeAllJournals(client: Client) {
  let journals = await client.journals.list();

  // remove all journals
  for (const journal of journals) {
    await client.journals.remove(journal);
  }

  journals = await client.journals.list();
  expect(journals).lengthOf(0);
}

describe("api", function () {
  let client: Client;

  before(async function () {
    const { port } = await initServer();
    client = configure(`http://localhost:${port}`);
  });

  describe("journals", function () {
    it("lets you create journals", async function () {
      try {
        const journal = await client.journals.create({ name: "chronicles" });
        console.log(journal);
      } catch (err) {
        // Hmmm maybe client library should do all of this.
        // It could even be go like and return data | error?
        // where an error is a known error, giving a simpler way to
        // branch on them
        if (err instanceof ky.HTTPError && err.response.status === 400) {
          const errorName = await err.response.json();
          errorName.title = "name must be unique";
          expect(errorName.title).to.equal("name must be unique");
        } else {
          throw err;
        }
      }
    });

    // If client library prevents this, does it matter?
    it("returns 400 and error when missing name");

    it("lets you create and delete journals", async function () {
      await createIgnoreDuplicate(client, "chronicles");
      await createIgnoreDuplicate(client, "jogging");
      await createIgnoreDuplicate(client, "guitar");

      // Assert against the created journals
      let journals = await client.journals.list();
      expect(journals).to.have.length.greaterThan(2);

      // Each journal has expected name
      expect(
        journals.find((j) => j.name === "chronicles"),
        "journal named chronicles exists"
      ).to.exist;
      expect(
        journals.find((j) => j.name === "jogging"),
        "journal named jogging exists"
      ).to.exist;
      expect(
        journals.find((j) => j.name === "guitar"),
        "journal named guitar exists"
      ).to.exist;

      await removeAllJournals(client);
    });
  });

  describe("documents", function () {
    let journal: any;

    before(async function () {
      // todo: automate clean-up behaviors when needed.
      await removeAllJournals(client);
      journal = await client.journals.create({ name: "chronicles" });
    });

    after(async function () {
      await removeAllJournals(client);
    });

    it("returns 400 when document id missing or journalId invalid");

    it("lets you create documents", async function () {
      // todo: without id
      // todo: update existing
      // todo: invalid id
      const document = await client.documents.save({
        journalId: journal.id,
        content: "# Hello, World! \n\n Some markdown content!",
        title: "And this one has a title even",
      });

      expect(document.id).to.exist;
      expect(document.title).to.exist;
      expect(document.journalId).to.equal(journal.id);
      expect(document.createdAt).to.exist;
      expect(document.updatedAt).to.exist;
    });

    it("lets you create documents without a title", async function () {
      const document = await client.documents.save({
        journalId: journal.id,
        content: "# Hello, World! \n\n Some markdown content!",
      });

      expect(document.id).to.exist;
      expect(document.title).to.not.exist;
    });

    it("lets you fetch documents by id", async function () {
      const document = await client.documents.save({
        journalId: journal.id,
        content: "# Hello, World! \n\n Some markdown content!",
      });

      const remoteDocument = await client.documents.findById({
        documentId: document.id,
      });

      (expect(remoteDocument).to.be as any).jsonSchema(schema);

      expect(remoteDocument.id).to.equal(
        document.id,
        "document ids should match"
      );
      expect(remoteDocument.journalId).to.equal(
        document.journalId,
        "journal ids should match"
      );

      // todo: this needs more thought...
      // expect(remoteDocument.updatedAt).to.not.equal(
      //   document.updatedAt,
      //   "updated timestamp should be newer"
      // );
    });

    it("lets you create documents with same title in the same journal");
    it("lets you update documents");
    it("cascades journal deletions to delete documents shrug");
  });

  describe("document search", function () {
    let journals: any[];
    let documents: Array<GetDocumentResponse>;

    before(async function () {
      await removeAllJournals(client);

      // create two journals
      journals = await Promise.all([
        client.journals.create({ name: "chronicles" }),
        client.journals.create({ name: "golf" }),
      ]);

      // create documents
      // note: Not Promise.all so we can maintain order
      documents = [
        await client.documents.save({
          journalId: journals[0].id,
          content: "# Hello, World! \n\n Some markdown content!",
        }),
        await client.documents.save({
          journalId: journals[0].id,
          content: "This is my second chronicles **entry**. Hurrah.",
        }),
        await client.documents.save({
          journalId: journals[0].id,
          content: "This is my third chronicles **document**. `code is good`",
        }),
        await client.documents.save({
          journalId: journals[1].id,
          content: "This is my first _golf_ entry.",
        }),
        await client.documents.save({
          journalId: journals[1].id,
          content: "This is my second _golf_ entry. I am still bad at it.",
        }),
      ];
    });

    it("returns all documents ordered by creation", async function () {
      const results = await client.documents.search();

      expect(results.data).lengthOf(
        documents.length,
        "it should return all documents"
      );

      // More recent documents should be returned first
      const expectedDates = documents.map((d) => d.createdAt).reverse();
      const actual = results.data.map((d) => d.createdAt);
      expect(expectedDates).to.eql(actual);
    });

    it("returns documents by journal", async function () {
      const results = await Promise.all([
        await client.documents.search({
          journals: [journals[0].id],
        }),
        await client.documents.search({
          journals: [journals[1].id],
        }),
      ]);

      expect(results[0].data).lengthOf(
        documents.filter((d) => d.journalId === journals[0].id).length,
        `Should return all documents from ${journals[0].name}`
      );

      expect(results[1].data).lengthOf(
        documents.filter((d) => d.journalId === journals[1].id).length,
        `Should return all documents from ${journals[1].name}`
      );
    });

    it("returns documents by title, across journals");
    it("returns documents by title, single journal");
  });
});
