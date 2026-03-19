import { and, eq, sql } from "drizzle-orm";
import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type {
  GetDocumentResponse,
  SearchRequest,
} from "../preload/client/types";
import { createId } from "../preload/client/util";
import type { IDocumentsClient } from "./documents";
import * as schema from "./schema";
import { bulkOperationItems, bulkOperations } from "./schema";

export type BulkOperationType = "add_tag" | "remove_tag" | "change_journal";

export interface BulkOperationParams {
  tag?: string;
  journal?: string;
}

export interface BulkOperation {
  id: string;
  type: BulkOperationType;
  search: string; // JSON-stringified SearchRequest
  params: string; // JSON-stringified BulkOperationParams
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalItems: number;
  successCount: number;
  errorCount: number;
}

export interface BulkOperationItem {
  operationId: string;
  documentId: string;
  status: "pending" | "success" | "error";
  error?: string;
  processedAt?: string;
}

export interface CreateBulkOperationRequest {
  type: BulkOperationType;
  search: SearchRequest;
  params: BulkOperationParams;
}

export interface BulkOperationDetail {
  operation: BulkOperation;
  items: BulkOperationItem[];
}

export type IBulkOperationsClient = BulkOperationsClient;

export class BulkOperationsClient {
  constructor(
    private db: BunSQLiteDatabase<typeof schema>,
    private documents: IDocumentsClient,
  ) {}

  /**
   * Create a new bulk operation
   * @param request - The operation type, search, and parameters
   * @returns The operation ID
   */
  create = async (request: CreateBulkOperationRequest): Promise<string> => {
    const { type, search, params } = request;

    // TODO: Only get the ids from the search request to speed this up.
    const docs = await this.documents.search(search);

    if (docs.data.length === 0) {
      throw new Error("No documents provided for bulk operation");
    }

    // Validate operation type and params
    this.validateOperation(type, params);

    const operationId = createId();

    await this.db.transaction(async (trx) => {
      // Insert operation record
      await trx.insert(bulkOperations).values({
        id: operationId,
        type,
        search: JSON.stringify(search),
        params: JSON.stringify(params),
        status: "pending",
        totalItems: docs.data.length,
        successCount: 0,
        errorCount: 0,
      });

      // Insert items in batches to avoid SQLite's compound SELECT limit
      const items = docs.data.map((doc) => ({
        operationId,
        documentId: doc.id,
        status: "pending",
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        await trx.insert(bulkOperationItems).values(batch);
      }
    });

    return operationId;
  };

  /**
   * Process a bulk operation iteratively
   * @param operationId - The operation ID to process
   */
  process = async (operationId: string): Promise<void> => {
    const [operation] = await this.db
      .select()
      .from(bulkOperations)
      .where(eq(bulkOperations.id, operationId));

    if (!operation) {
      throw new Error(`Bulk operation ${operationId} not found`);
    }

    if (operation.status === "completed") {
      throw new Error(`Bulk operation ${operationId} already completed`);
    }

    const params: BulkOperationParams = JSON.parse(operation.params);

    // Update operation status to running
    await this.db
      .update(bulkOperations)
      .set({
        status: "running",
        startedAt: new Date().toISOString(),
      })
      .where(eq(bulkOperations.id, operationId));

    // Get pending items
    const items = await this.db
      .select()
      .from(bulkOperationItems)
      .where(
        and(
          eq(bulkOperationItems.operationId, operationId),
          eq(bulkOperationItems.status, "pending"),
        ),
      );

    // Process each item
    for (const item of items) {
      try {
        await this.processItem(
          operation.type as BulkOperationType,
          item.documentId,
          params,
        );

        await this.db
          .update(bulkOperationItems)
          .set({
            status: "success",
            processedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(bulkOperationItems.operationId, operationId),
              eq(bulkOperationItems.documentId, item.documentId),
            ),
          );

        await this.db
          .update(bulkOperations)
          .set({ successCount: sql`${bulkOperations.successCount} + 1` })
          .where(eq(bulkOperations.id, operationId));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await this.db
          .update(bulkOperationItems)
          .set({
            status: "error",
            error: errorMessage,
            processedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(bulkOperationItems.operationId, operationId),
              eq(bulkOperationItems.documentId, item.documentId),
            ),
          );

        await this.db
          .update(bulkOperations)
          .set({ errorCount: sql`${bulkOperations.errorCount} + 1` })
          .where(eq(bulkOperations.id, operationId));
      }
    }

    // Mark operation complete
    await this.db
      .update(bulkOperations)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
      })
      .where(eq(bulkOperations.id, operationId));
  };

  /**
   * List all bulk operations
   * @returns Array of operations ordered by creation date (descending)
   */
  list = async (): Promise<BulkOperation[]> => {
    const rows = await this.db
      .select()
      .from(bulkOperations)
      .orderBy(sql`${bulkOperations.createdAt} DESC`);

    return rows as BulkOperation[];
  };

  /**
   * Get a specific bulk operation with its items
   * @param operationId - The operation ID
   * @returns The operation and its items
   */
  get = async (operationId: string): Promise<BulkOperationDetail> => {
    const [operation] = await this.db
      .select()
      .from(bulkOperations)
      .where(eq(bulkOperations.id, operationId));

    if (!operation) {
      throw new Error(`Bulk operation ${operationId} not found`);
    }

    const items = await this.db
      .select()
      .from(bulkOperationItems)
      .where(eq(bulkOperationItems.operationId, operationId));

    return {
      operation: operation as BulkOperation,
      items: items as BulkOperationItem[],
    };
  };

  /**
   * Validate operation type and parameters
   */
  private validateOperation = (
    type: BulkOperationType,
    params: BulkOperationParams,
  ): void => {
    switch (type) {
      case "add_tag":
      case "remove_tag":
        if (!params.tag) {
          throw new Error(`Operation ${type} requires 'tag' parameter`);
        }
        break;
      case "change_journal":
        if (!params.journal) {
          throw new Error(`Operation ${type} requires 'journal' parameter`);
        }
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  };

  /**
   * Process a single item based on operation type
   */
  private processItem = async (
    type: BulkOperationType,
    documentId: string,
    params: BulkOperationParams,
  ): Promise<void> => {
    const doc = await this.documents.findById({ id: documentId });

    switch (type) {
      case "add_tag":
      case "remove_tag":
        await this.modifyTags(doc, params.tag!, type === "add_tag");
        break;
      case "change_journal":
        await this.documents.updateDocument({
          ...doc,
          journal: params.journal!,
        });
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  };

  /**
   * Add or remove a tag from a document
   */
  private modifyTags = async (
    doc: GetDocumentResponse,
    tag: string,
    add: boolean,
  ): Promise<void> => {
    const tags = new Set(doc.frontMatter.tags || []);
    if (add) tags.add(tag);
    else tags.delete(tag);

    await this.documents.updateDocument({
      ...doc,
      frontMatter: {
        ...doc.frontMatter,
        tags: Array.from(tags),
      },
    });
  };
}
