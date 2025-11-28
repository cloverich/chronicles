import { makeObservable, observable } from "mobx";
import { toast } from "sonner";
import { IClient } from "../useClient";
import { IJournalStore } from "./journals";

export class SyncStore {
  isSyncing: boolean = false;
  lastSyncTime: Date | null = null;
  error: Error | null = null;

  constructor(
    private client: IClient,
    private journalsStore: IJournalStore,
  ) {
    makeObservable(this, {
      isSyncing: observable,
      lastSyncTime: observable,
      error: observable,
    });
  }

  /**
   * Sync the filesystem to the database cache.
   * This is the central place to call sync in the UI.
   *
   * @param force - If true, bypass the 1-hour check and force sync
   * @returns Promise that resolves when sync completes
   */
  sync = async (force: boolean = false): Promise<void> => {
    // Prevent duplicate calls - no-op if already syncing
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping duplicate call");
      return;
    }

    this.isSyncing = true;
    this.error = null;
    let toastId: string | number | null = null;

    try {
      // Show toast notification
      toastId = toast.info("Syncing cache...may take a few minutes", {
        duration: Infinity,
      });

      // Call underlying client sync
      await this.client.sync.sync(force);

      // Update last sync time
      this.lastSyncTime = new Date();

      // Refresh journals to pick up any new journals or changes
      await this.journalsStore.refresh();

      // Dismiss loading toast and show success
      toast.dismiss(toastId);
      toast.success("Cache synced");
    } catch (err: any) {
      console.error("Error during sync:", err);
      this.error = err;

      // Dismiss loading toast and show error
      if (toastId) toast.dismiss(toastId);
      toast.error("Failed to sync cache");

      throw err;
    } finally {
      this.isSyncing = false;
    }
  };

  /**
   * Check if sync is needed (> 1 hour since last sync)
   */
  needsSync = async (): Promise<boolean> => {
    return this.client.sync.needsSync();
  };
}

export type ISyncStore = SyncStore;
