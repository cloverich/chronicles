import { describe, it } from "mocha";
import client, { Client } from ".";
import { assert } from "chai";

describe("Client.journals", function () {
  it("can be instantiated", function () {});

  it("can add", async function () {
    // todo: create a small set of local markdown files for testing,
    // or use a smaller journal
    this.timeout(12000);

    await client.journals.add({
      name: "reading",
      url: "/Users/cloverich/Google Drive/notes/chronicles",
      unit: "day",
    });

    const res = await client.journals.add({
      name: "reading",
      url: "/Users/cloverich/Google Drive/notes/reading",
      unit: "day",
    });

    assert.exists(res);
    assert.exists(res.find((j) => j.name === "reading"));
    assert.exists(res.find((j) => j.name === "Chronicles"));
  });

  it("list", async function () {
    const res = await client.journals.list();
  });
});

describe("Client.docs", function () {
  it("can get a document", async function () {
    // Assumes prior test ran
    // this is getting absurd...
    const document = await client.docs.findOne({
      journalName: "Chronicles",
      date: "2020-06-30",
    });

    assert.exists(document);
    assert.isNotEmpty(document.raw);
    assert.exists(document.mdast);
    assert.isObject(document.mdast);
  });

  it("can search for many documents", async function () {
    const { docs, query } = await client.docs.search({
      journals: ["Chronicles"],
    });

    assert.exists(docs);
    assert.isArray(docs);
    assert.exists(query);
    assert.deepEqual(query, { journals: ["Chronicles"] });
  });

  it("can save a document (mdast)", async function () {
    const document = await client.docs.findOne({
      journalName: "Chronicles",
      date: "2020-06-30",
    });
    // document.
    // send it right back
    await client.docs.save({
      ...document,
      journalName: "Chronicles",
      date: "2020-06-30",
    });
  });

  it("throws if journal is not found", async function () {
    await client.docs.save({
      raw: "foo bar baz",
      journalName: "made-up-journal",
      date: "2020-06-30",
    });
  });

  it("throws if date is invalid", async function () {
    await client.docs.save({
      raw: "foo bar baz",
      journalName: "Chronicles",
      date: "2020-06-30 05:03:31",
    });
  });

  it("throws if ");
});
