import { eq } from "drizzle-orm";
import fs from "fs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createMemoryNotesClient } from "../contract/memory";
import type { NotesClient } from "../contract/notes";
import {
  runScenario,
  type ContractFixture,
  type ContractLibrary,
} from "../contract/scenario";
import { createClient } from "./factory";
import { createNodeNotesClient } from "./notes-adapter";
import * as schema from "./schema";

/**
 * Black-box NotesClient suite: every scenario in spec/vectors/contract runs
 * against the in-memory reference adapter and the Node adapter. With
 * UPDATE_VECTORS=1, "$fill" responses are regenerated from the Node adapter
 * (placeholders are kept); review the diff by hand.
 */

const DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../spec/vectors/contract",
);
const UPDATE = process.env.UPDATE_VECTORS === "1";

function library(name: string): ContractLibrary {
  return JSON.parse(
    fs.readFileSync(path.join(DIR, "libraries", `${name}.json`), "utf8"),
  );
}

async function nodeAdapter(lib: ContractLibrary): Promise<NotesClient> {
  const notesDir = fs.mkdtempSync(path.join(tmpdir(), "chronicles-contract-"));
  const client = await createClient({ dbPath: ":memory:", notesDir });
  for (const j of lib.journals) {
    await client.journals.index(j.name, j.id);
    client.db
      .update(schema.journals)
      .set({ archivedAt: j.archivedAt })
      .where(eq(schema.journals.id, j.id))
      .run();
  }
  // The library defines every journal; drop the startup default.
  client.db
    .delete(schema.journals)
    .where(eq(schema.journals.name, "default_journal"))
    .run();
  for (const n of lib.notes) {
    await client.documents.importDocument({
      id: n.id,
      journal: lib.journals.find((j) => j.id === n.journalId)!.name,
      title: n.title ?? undefined,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      tags: n.tags,
      content: n.content,
      frontMatter: n.frontMatter,
    });
  }
  return createNodeNotesClient({
    documents: client.documents,
    journals: client.journals,
    tags: client.tags,
    attachments: client.files.attachments,
  });
}

async function memoryAdapter(lib: ContractLibrary): Promise<NotesClient> {
  const client = createMemoryNotesClient(lib);
  await client.ready;
  return client;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));

if (UPDATE) {
  for (const file of files) {
    const fixturePath = path.join(DIR, file);
    const fixture: ContractFixture = JSON.parse(
      fs.readFileSync(fixturePath, "utf8"),
    );
    for (const scenario of fixture.scenarios) {
      const client = await nodeAdapter(library(scenario.library));
      scenario.steps = await runScenario(client, scenario, { fill: true });
    }
    fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
  }
}

for (const [adapterName, makeAdapter] of [
  ["memory", memoryAdapter],
  ["node", nodeAdapter],
] as const) {
  describe(`NotesClient contract: ${adapterName} adapter`, () => {
    for (const file of files) {
      const fixture: ContractFixture = JSON.parse(
        fs.readFileSync(path.join(DIR, file), "utf8"),
      );
      for (const scenario of fixture.scenarios) {
        test(`${file}: ${scenario.name}`, async () => {
          const client = await makeAdapter(library(scenario.library));
          await runScenario(client, scenario);
          assert.ok(true);
        });
      }
    }
  });
}

test("src/contract imports nothing outside itself (runtime-free boundary)", () => {
  const contractDir = path.resolve(DIR, "../../../src/contract");
  for (const file of fs.readdirSync(contractDir)) {
    const source = fs.readFileSync(path.join(contractDir, file), "utf8");
    for (const [, spec] of source.matchAll(/from\s+"([^"]+)"/g)) {
      assert.match(spec, /^\.\/[\w-]+$/, `${file} imports ${spec}`);
    }
  }
});
