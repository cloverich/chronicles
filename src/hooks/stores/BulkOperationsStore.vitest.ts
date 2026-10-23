import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryNotesClient } from "../../contract/memory";
import { fakeSettings } from "../../test/fakes";
import { BulkOperationsStore } from "./BulkOperationsStore";
import { JournalsStore } from "./journals";

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  });
  return { toast };
});

const OJO = { id: "j-ojo", name: "ojo" };

const note = (id: string, journalId: string) => ({
  id,
  journalId,
  title: id,
  content: "",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

async function setup(defaultJournal = "ojo") {
  const notes = createMemoryNotesClient({
    journals: [
      { id: "j-old", name: "old" },
      { id: "j-ojo", name: "ojo" },
      { id: "j-keep", name: "keep" },
    ],
    notes: [
      note("n1", "j-old"),
      note("n2", "j-old"),
      note("n3", "j-keep"),
      note("n4", "j-ojo"),
    ],
  });
  await notes.ready;
  const journals = await JournalsStore.init(
    notes,
    fakeSettings({ defaultJournal }),
  );
  const store = new BulkOperationsStore(notes, journals);
  return { notes, journals, store };
}

/** The action of the "is now empty" toast for `name`, if offered. */
function emptyOffer(name: string) {
  const call = vi
    .mocked(toast)
    .mock.calls.find(([msg]) => msg === `"${name}" is now empty`);
  return call && { options: call[1] as any };
}

describe("BulkOperationsStore.changeJournal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refreshes journal counts after the move", async () => {
    const { journals, store } = await setup();
    await store.changeJournal({ journalIds: ["j-old"] }, OJO);

    const count = (id: string) =>
      journals.journals.find((j) => j.id === id)!.noteCount;
    expect(count("j-old")).toBe(0);
    expect(count("j-ojo")).toBe(3);
  });

  it("offers to delete only journals the move emptied", async () => {
    const { store } = await setup();
    await store.changeJournal({ journalIds: ["j-old"] }, OJO);

    expect(emptyOffer("old")?.options.action.label).toBe("Delete journal");
    expect(emptyOffer("keep")).toBeUndefined();
    expect(emptyOffer("ojo")).toBeUndefined();
  });

  it("deletes the emptied journal and keeps the moved notes", async () => {
    const { notes, journals, store } = await setup();
    await store.changeJournal({ journalIds: ["j-old"] }, OJO);
    emptyOffer("old")!.options.action.onClick();

    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Deleted "old"'),
    );
    expect(journals.journals.map((j) => j.name)).not.toContain("old");
    const { count } = await notes.countNotes({ journalIds: ["j-ojo"] });
    expect(count).toBe(3);
  });

  it("does not delete a journal that gained notes since the offer", async () => {
    const { notes, journals, store } = await setup();
    await store.changeJournal({ journalIds: ["j-old"] }, OJO);
    await notes.createNote({ journalId: "j-old", content: "new" });
    emptyOffer("old")!.options.action.onClick();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '"old" has notes again; not deleted',
      ),
    );
    expect(journals.journals.map((j) => j.name)).toContain("old");
  });

  it("does not offer deleting the default journal", async () => {
    const { store } = await setup("old");
    await store.changeJournal({ journalIds: ["j-old"] }, OJO);

    const offer = emptyOffer("old")!;
    expect(offer.options.action).toBeUndefined();
    expect(offer.options.description).toMatch(/default journal/);
  });
});
