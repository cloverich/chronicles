import { describe, expect, it } from "vitest";
import { createMemoryNotesClient } from "../../contract/memory";
import { isNotesError } from "../../contract/notes";
import { EditableDocument } from "./EditableDocument";

async function setup() {
  const notes = createMemoryNotesClient({
    journals: [{ id: "j1", name: "work" }],
    notes: [
      {
        id: "n1",
        journalId: "j1",
        title: "Note",
        content: "v0",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
  });
  await notes.ready;
  const load = async () => {
    const doc = new EditableDocument(notes, await notes.getNote({ id: "n1" }));
    doc.teardown?.();
    return doc;
  };
  return { notes, load };
}

describe("EditableDocument saves (in-memory NotesClient)", () => {
  it("serializes concurrent saves so each uses the previous revision", async () => {
    const { notes, load } = await setup();
    const doc = await load();

    doc.content = "v1";
    const first = (doc as any).persist();
    doc.content = "v2";
    const second = (doc as any).persist();
    await Promise.all([first, second]);

    const stored = await notes.getNote({ id: "n1" });
    expect(stored.content).toBe("v2");
    expect(doc.revision).toBe(stored.revision);
  });

  it("a stale editor gets a conflict and does not overwrite", async () => {
    const { notes, load } = await setup();
    const a = await load();
    const b = await load();

    a.content = "from a";
    await (a as any).persist();

    b.content = "from b";
    const err = await (b as any).persist().catch((e: unknown) => e);
    expect(isNotesError(err) && err.code).toBe("conflict");
    expect((await notes.getNote({ id: "n1" })).content).toBe("from a");

    // A failed save doesn't wedge the queue.
    b.revision = (await notes.getNote({ id: "n1" })).revision;
    await (b as any).persist();
    expect((await notes.getNote({ id: "n1" })).content).toBe("from b");
  });
});
