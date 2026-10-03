import { action, makeObservable, observable, runInAction } from "mobx";
import { toast } from "sonner";
import type { BulkOp, NoteQuery, NotesClient } from "../../contract/notes";

export type OperationStatus = "idle" | "processing" | "completed" | "error";

export class BulkOperationsStore {
  status: OperationStatus = "idle";
  /** Guards status against an older run finishing after a newer one. */
  private runId = 0;

  constructor(private notes: NotesClient) {
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

  /** Move all notes matching the query to a journal. */
  changeJournal = (query: NoteQuery, journal: { id: string; name: string }) =>
    this.run(
      query,
      { type: "change_journal", journalId: journal.id },
      `Moving to "${journal.name}"`,
    );

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
