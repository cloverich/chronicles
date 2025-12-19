import { makeObservable, observable } from "mobx";
import { toast } from "sonner";
import { IClient } from "../useClient";
import { IJournalStore } from "./journals";

export class IndexerStore {
  isIndexing: boolean = false;
  lastIndexTime: Date | null = null;
  error: Error | null = null;

  constructor(
    private client: IClient,
    private journalsStore: IJournalStore,
  ) {
    makeObservable(this, {
      isIndexing: observable,
      lastIndexTime: observable,
      error: observable,
    });
  }

  /**
   * Index the filesystem into the database cache.
   * This is the central place to call index in the UI.
   *
   * @param fullReindex - If true, skip mtime/hash optimizations and re-parse all documents.
   *                      Automatically true if > 1 month since last index.
   * @returns Promise that resolves when indexing completes
   */
  index = async (fullReindex: boolean = false): Promise<void> => {
    // Prevent duplicate calls - no-op if already indexing
    if (this.isIndexing) {
      console.log("Index already in progress, skipping duplicate call");
      return;
    }

    this.isIndexing = true;
    this.error = null;
    let toastId: string | number | null = null;

    try {
      // Show toast notification
      toastId = toast.loading("Indexing notes...");

      // Call underlying client index
      await this.client.indexer.index(fullReindex);

      // Update last index time
      this.lastIndexTime = new Date();

      // Refresh journals to pick up any new journals or changes
      await this.journalsStore.refresh();

      // Dismiss loading toast and show success
      toast.dismiss(toastId);
      toast.success("Index updated");
    } catch (err: any) {
      console.error("Error during indexing:", err);
      this.error = err;

      // Dismiss loading toast and show error
      if (toastId) toast.dismiss(toastId);
      toast.error("Failed to update index");

      throw err;
    } finally {
      this.isIndexing = false;
    }
  };

  /**
   * Check if a full re-index is needed (> 1 month since last index)
   */
  needsFullReindex = async (): Promise<boolean> => {
    return this.client.indexer.needsFullReindex();
  };
}

export type IIndexerStore = IndexerStore;
