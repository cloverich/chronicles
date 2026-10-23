import { action, makeObservable, observable, runInAction } from "mobx";
import { toast } from "sonner";
import type {
  BulkOp,
  Journal,
  NoteQuery,
  NotesClient,
} from "../../contract/notes";
import type { JournalsStore } from "./journals";

export type OperationStatus = "idle" | "processing" | "completed" | "error";

export class BulkOperationsStore {
  status: OperationStatus = "idle";
  /** Guards status against an older run finishing after a newer one. */
  private runId = 0;

  constructor(
    private notes: NotesClient,
    private journals: JournalsStore,
  ) {
    makeObservable(this, {
      status: observable,
      addTag: action,
      removeTag: action,
      changeJournal: action,
    });
  }

  /** Add a tag to all notes matching the query. */
  addTag = (query: NoteQuery, tag: string) =>
    this.run(query, { type: "add_tag", tag }, `Adding tag "${tag}"`);

  /** Remove a tag from all notes matching the query. */
  removeTag = (query: NoteQuery, tag: string) =>
    this.run(query, { type: "remove_tag", tag }, `Removing tag "${tag}"`);

  /**
   * Move all notes matching the query to a journal, then refresh journal
   * counts and offer to delete any journal the move left empty.
   */
  changeJournal = async (
    query: NoteQuery,
    journal: { id: string; name: string },
  ) => {
    const before = new Map(
      (await this.notes.listJournals()).journals.map((j) => [
        j.id,
        j.noteCount,
      ]),
    );
    await this.run(
      query,
      { type: "change_journal", journalId: journal.id },
      `Moving to "${journal.name}"`,
    );

    try {
      await this.journals.refresh();
    } catch {
      return; // refresh logs; the move itself already reported
    }
    for (const j of this.journals.journals) {
      if (j.id !== journal.id && j.noteCount === 0 && before.get(j.id)) {
        this.offerDelete(j);
      }
    }
  };

  private offerDelete = (journal: Journal) => {
    const isDefault = journal.name === this.journals.defaultJournal;
    toast(`"${journal.name}" is now empty`, {
      duration: 15_000,
      description: isDefault
        ? "It's the default journal; choose another default to delete it."
        : undefined,
      action: isDefault
        ? undefined
        : {
            label: "Delete journal",
            onClick: () => void this.deleteIfEmpty(journal.id),
          },
    });
  };

  /** Re-checks emptiness, since notes may have been added since the offer. */
  private deleteIfEmpty = async (id: string) => {
    try {
      await this.journals.refresh();
      const journal = this.journals.journals.find((j) => j.id === id);
      if (!journal) return;
      if (journal.noteCount > 0) {
        toast.error(`"${journal.name}" has notes again; not deleted`);
        return;
      }
      await this.journals.remove(journal);
      toast.success(`Deleted "${journal.name}"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Delete failed: ${message}`);
    }
  };

  private run = async (
    query: NoteQuery,
    op: BulkOp,
    label: string,
  ): Promise<void> => {
    // sonner defers mounting new toasts via setTimeout but applies dismiss()
    // synchronously. With sqlite the whole operation can finish before that
    // timer fires, so dismiss+new-toast leaves the loading toast orphaned.
    // Updating the toast in place by id is queued after the mount instead.
    const toastId = toast.loading(label);
    const runId = ++this.runId;
    runInAction(() => {
      this.status = "processing";
    });

    try {
      const result = await this.notes.bulkUpdate({ query, op });
      if (result.failed.length > 0) {
        toast.error(
          `${label}: ${result.failed.length} of ${result.matched} notes failed`,
          { id: toastId },
        );
      } else {
        toast.success(`${label} complete`, { id: toastId });
      }
      if (runId === this.runId) {
        runInAction(() => {
          this.status = result.failed.length > 0 ? "error" : "completed";
        });
      }
    } catch (err) {
      console.error("Bulk operation failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(`${label} failed: ${errorMessage}`, { id: toastId });
      if (runId === this.runId) {
        runInAction(() => {
          this.status = "error";
        });
      }
    }
  };
}
