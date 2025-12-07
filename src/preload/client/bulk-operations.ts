import { Knex } from "knex";
import { IDocumentsClient } from "./documents";
import { GetDocumentResponse, SearchRequest } from "./types";
import { createId } from "./util";

export type BulkOperationType = "add_tag" | "remove_tag" | "change_journal";

export interface BulkOperationParams {
  tag?: string;
  journal?: string;
}

export interface BulkOperation {
  id: string;
  type: BulkOperationType;
  search: SearchRequest;
  params: string; // JSON stringified
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
    private knex: Knex,
    private documents: IDocumentsClient,
  ) {}

  /**
   * Create a new bulk operation
   * @param request - The operation type, document IDs, and parameters
   * @returns The operation ID
   */
  create = async (request: CreateBulkOperationRequest): Promise<string> => {
    const { type, search, params } = request;

    // TODO: Only get the ids from the search request to speed this up.
    const documents = await this.documents.search(search);

    if (documents.data.length === 0) {
      throw new Error("No documents provided for bulk operation");
    }

    // Validate operation type and params
    this.validateOperation(type, params);

    const operationId = createId();

    await this.knex.transaction(async (trx) => {
      // Insert operation record
      await trx("bulk_operations").insert({
        id: operationId,
        type,
        search: JSON.stringify(search),
        params: JSON.stringify(params),
        status: "pending",
        totalItems: documents.data.length,
        successCount: 0,
        errorCount: 0,
      });

      // Insert items in batches to avoid SQLite's compound SELECT limit
      const items = documents.data.map((doc) => ({
        operationId,
        documentId: doc.id,
        status: "pending",
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        await trx("bulk_operation_items").insert(batch);
      }
    });

    return operationId;
  };

  /**
   * Process a bulk operation iteratively
   * @param operationId - The operation ID to process
   */
  process = async (operationId: string): Promise<void> => {
    const operation = await this.knex<BulkOperation>("bulk_operations")
      .where({ id: operationId })
      .first();

    if (!operation) {
      throw new Error(`Bulk operation ${operationId} not found`);
    }

    if (operation.status === "completed") {
      throw new Error(`Bulk operation ${operationId} already completed`);
    }

    const params: BulkOperationParams = JSON.parse(operation.params);

    // Update operation status to running
    await this.knex("bulk_operations").where({ id: operationId }).update({
      status: "running",
      startedAt: new Date().toISOString(),
    });

    // Get pending items
    const items = await this.knex<BulkOperationItem>("bulk_operation_items")
      .where({ operationId, status: "pending" })
      .select("*");

    // Process each item
    for (const item of items) {
      try {
        await this.processItem(operation.type, item.documentId, params);

        await this.knex("bulk_operation_items")
          .where({ operationId, documentId: item.documentId })
          .update({
            status: "success",
            processedAt: new Date().toISOString(),
          });

        await this.knex("bulk_operations")
          .where({ id: operationId })
          .increment("successCount", 1);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await this.knex("bulk_operation_items")
          .where({ operationId, documentId: item.documentId })
          .update({
            status: "error",
            error: errorMessage,
            processedAt: new Date().toISOString(),
          });

        await this.knex("bulk_operations")
          .where({ id: operationId })
          .increment("errorCount", 1);
      }
    }

    // Mark operation complete
    await this.knex("bulk_operations").where({ id: operationId }).update({
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  };

  /**
   * List all bulk operations
   * @returns Array of operations ordered by creation date (descending)
   */
  list = async (): Promise<BulkOperation[]> => {
    return this.knex<BulkOperation>("bulk_operations")
      .select("*")
      .orderBy("createdAt", "desc");
  };

  /**
   * Get a specific bulk operation with its items
   * @param operationId - The operation ID
   * @returns The operation and its items
   */
  get = async (operationId: string): Promise<BulkOperationDetail> => {
    const operation = await this.knex<BulkOperation>("bulk_operations")
      .where({ id: operationId })
      .first();

    if (!operation) {
      throw new Error(`Bulk operation ${operationId} not found`);
    }

    const items = await this.knex<BulkOperationItem>("bulk_operation_items")
      .where({ operationId })
      .select("*");

    return { operation, items };
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
        await this.addTag(doc, params.tag!);
        break;
      case "remove_tag":
        await this.removeTag(doc, params.tag!);
        break;
      case "change_journal":
        await this.changeJournal(doc, params.journal!);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  };

  /**
   * Add a tag to a document
   */
  private addTag = async (
    doc: GetDocumentResponse,
    tag: string,
  ): Promise<void> => {
    const tags = new Set(doc.frontMatter.tags || []);
    tags.add(tag);

    await this.documents.updateDocument({
      ...doc,
      frontMatter: {
        ...doc.frontMatter,
        tags: Array.from(tags),
      },
    });
  };

  /**
   * Remove a tag from a document
   */
  private removeTag = async (
    doc: GetDocumentResponse,
    tag: string,
  ): Promise<void> => {
    const tags = new Set(doc.frontMatter.tags || []);
    tags.delete(tag);

    await this.documents.updateDocument({
      ...doc,
      frontMatter: {
        ...doc.frontMatter,
        tags: Array.from(tags),
      },
    });
  };

  /**
   * Change the journal of a document
   */
  private changeJournal = async (
    doc: GetDocumentResponse,
    newJournal: string,
  ): Promise<void> => {
    await this.documents.updateDocument({
      ...doc,
      journal: newJournal,
    });
  };
}
