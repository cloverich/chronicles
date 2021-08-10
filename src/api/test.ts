import { describe, it, before } from "mocha";
import { configure, Client } from "./client";
import initServer from "./init";

describe("journals", function () {
  let client: Client;

  before(async function () {
    const { port } = await initServer();
    client = configure(`http://localhost:${port}`);
  });

  it("lets you create journals", async function () {
    const journal = await client.journals.create({ name: "chronicles" });
    console.log(journal);
  });

  it("lets you create and delete journals", async function () {});
});
