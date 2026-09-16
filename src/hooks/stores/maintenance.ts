import { makeObservable, observable } from "mobx";
import { toast } from "sonner";
import type { IClient } from "../useClient";
import type { IJournalStore } from "./journals";

export class MaintenanceStore {
  isRepairing: boolean = false;
  lastRepairTime: Date | null = null;
  error: Error | null = null;

  constructor(
    private client: IClient,
    private journalsStore: IJournalStore,
  ) {
    makeObservable(this, {
      isRepairing: observable,
      lastRepairTime: observable,
      error: observable,
    });
  }

  /**
   * Regenerates derived state (search index, note links, image references)
   * from the documents stored in SQLite. Use when search results or links
   * look wrong.
   *
   * @returns Promise that resolves when the repair completes
   */
  /**
   * Deletes all notes, journals, and import records so an import can be
   * re-run from scratch. Attachments on disk are left in place.
   */
  resetNotes = async (): Promise<void> => {
    if (this.isRepairing) return;
    this.isRepairing = true;
    try {
      await this.client.documents.deleteAll();
      await this.client.journals.ensureDefault();
      this.lastRepairTime = new Date();
      await this.journalsStore.refresh();
      toast.success("All notes deleted");
    } catch (err: any) {
      console.error("Error resetting notes:", err);
      toast.error("Failed to reset notes");
      throw err;
    } finally {
      this.isRepairing = false;
    }
  };

  repair = async (): Promise<void> => {
    // Prevent duplicate calls - no-op if already repairing
    if (this.isRepairing) {
      console.log("Repair already in progress, skipping duplicate call");
      return;
    }

    this.isRepairing = true;
    this.error = null;
    let toastId: string | number | null = null;

    try {
      toastId = toast.loading("Repairing search index…");

      await this.client.documents.rebuildDerived();

      this.lastRepairTime = new Date();

      // Refresh journals to pick up any changes
      await this.journalsStore.refresh();

      // Update in place; see BulkOperationsStore for why dismiss() races here
      toast.success("Repair complete", { id: toastId });
    } catch (err: any) {
      console.error("Error during repair:", err);
      this.error = err;

      toast.error("Failed to repair search index", {
        id: toastId ?? undefined,
      });

      throw err;
    } finally {
      this.isRepairing = false;
    }
  };
}

export type IMaintenanceStore = MaintenanceStore;
