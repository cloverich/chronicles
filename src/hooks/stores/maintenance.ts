import { makeObservable, observable } from "mobx";
import { toast } from "sonner";
import type { Maintenance } from "../useMaintenance";
import type { IJournalStore } from "./journals";

export class MaintenanceStore {
  isRepairing: boolean = false;
  lastRepairTime: Date | null = null;
  error: Error | null = null;

  constructor(
    private maintenance: Maintenance,
    private journalsStore: IJournalStore,
  ) {
    makeObservable(this, {
      isRepairing: observable,
      lastRepairTime: observable,
      error: observable,
    });
  }

  /**
   * Deletes all notes, journals, and import records so an import can be
   * re-run from scratch. Attachments on disk are left in place.
   */
  resetNotes = async (): Promise<void> => {
    if (this.isRepairing) return;
    this.isRepairing = true;
    try {
      await this.maintenance.resetLibrary();
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

  /**
   * Regenerates derived state (search index, note links, image references)
   * from the documents stored in SQLite. Use when search results or links
   * look wrong.
   */
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

      await this.maintenance.rebuildDerived();

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
