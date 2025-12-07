import { action, makeObservable, observable, runInAction } from "mobx";
import { toast } from "sonner";
import { IBulkOperationsClient } from "../../preload/client/bulk-operations";
import { SearchRequest } from "../../preload/client/types";

export type OperationStatus = "idle" | "processing" | "completed" | "error";

export interface CurrentOperation {
  id: string;
  type: "add_tag" | "remove_tag" | "change_journal";
  label: string; // Human-readable description (e.g., "Adding tag 'work'")
}

export class BulkOperationsStore {
  status: OperationStatus = "idle";
  latestOperationId: string | null = null;

  constructor(private client: IBulkOperationsClient) {
    makeObservable(this, {
      status: observable,
      latestOperationId: observable,
      addTag: action,
      removeTag: action,
      changeJournal: action,
    });
  }

  /**
   * Add a tag to all documents matching the search
   */
  addTag = async (search: SearchRequest, tag: string): Promise<void> => {
    await this.executeOperation({
      type: "add_tag",
      search,
      params: { tag },
      label: `Adding tag "${tag}"`,
    });
  };

  /**
   * Remove a tag from all documents matching the search
   */
  removeTag = async (search: SearchRequest, tag: string): Promise<void> => {
    await this.executeOperation({
      type: "remove_tag",
      search,
      params: { tag },
      label: `Removing tag "${tag}"`,
    });
  };

  /**
   * Change the journal of all documents matching the search
   */
  changeJournal = async (
    search: SearchRequest,
    journal: string,
  ): Promise<void> => {
    await this.executeOperation({
      type: "change_journal",
      search,
      params: { journal },
      label: `Moving to "${journal}"`,
    });
  };

  /**
   * Execute any bulk operation
   */
  private executeOperation = async (config: {
    type: "add_tag" | "remove_tag" | "change_journal";
    search: SearchRequest;
    params: { tag?: string; journal?: string };
    label: string;
  }): Promise<void> => {
    const { type, search, params, label } = config;

    // Note: toast.loading cannot be user-dismissed in sonner; adding that
    // behavior requires custom toast rendering with an action button
    const toastId = toast.loading(label, { duration: Infinity });

    runInAction(() => {
      this.status = "processing";
    });

    let operationId: string | null = null;

    try {
      operationId = await this.client.create({
        type,
        search,
        params,
      });

      runInAction(() => {
        this.latestOperationId = operationId;
      });

      await this.client.process(operationId);

      toast.dismiss(toastId);
      toast.success(`${label} complete`);

      if (this.latestOperationId === operationId) {
        runInAction(() => {
          this.status = "completed";
        });
      }
    } catch (err) {
      console.error("Bulk operation failed:", err);
      toast.dismiss(toastId);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(`${label} failed: ${errorMessage}`);

      if (operationId && this.latestOperationId === operationId) {
        runInAction(() => {
          this.status = "error";
        });
      }
    }
  };
}
