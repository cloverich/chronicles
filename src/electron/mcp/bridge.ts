/**
 * MCP Bridge - Reuses existing preload clients for MCP server operations
 *
 * This bridge creates the same client structure used in the preload context
 * but runs in the main process for the MCP server to use.
 */

import DB from "better-sqlite3";
import Store from "electron-store";
import Knex from "knex";
import { IPreferences } from "../../hooks/stores/preferences";
import { DocumentsClient } from "../../preload/client/documents";
import { FilesClient } from "../../preload/client/files";
import { JournalsClient } from "../../preload/client/journals";
import { PreferencesClient } from "../../preload/client/preferences";
import { TagsClient } from "../../preload/client/tags";
import { IClient } from "../../preload/client/types";
import {
  CreateNoteParams,
  CreateNoteResponse,
  GetNoteMetadataParams,
  GetNoteParams,
  GetNoteResponse,
  ListJournalsResponse,
  NoteMetadata,
  PingResponse,
  SearchNotesParams,
  SearchNotesResponse,
  UpdateNoteParams,
  UpdateNoteResponse,
} from "./types";

export class MCPBridge {
  private client: IClient;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();

    // Recreate the same client setup as in preload/client/index.ts
    const settings = new Store<IPreferences>({
      name: "settings",
    });

    const db = DB(settings.get("databaseUrl") as string);
    const knex = Knex({
      client: "better-sqlite3",
      connection: {
        filename: settings.get("databaseUrl") as string,
      },
      useNullAsDefault: true,
    });

    const preferences = new PreferencesClient(settings);
    const files = new FilesClient(settings);
    const journals = new JournalsClient(knex, files, preferences);
    const documents = new DocumentsClient(db, knex, files, preferences);

    this.client = {
      journals,
      documents,
      tags: new TagsClient(knex),
      preferences,
      files,
      // MCP doesn't need sync, importer, or tests
      sync: null as any,
      importer: null as any,
      tests: null as any,
    };
  }

  async ping(): Promise<PingResponse> {
    return {
      status: "ok",
      version: "1.0.0", // TODO: Get from package.json
      uptime: Date.now() - this.startTime,
    };
  }

  async listJournals(): Promise<ListJournalsResponse> {
    const journals = await this.client.journals.list();
    return {
      journals: journals.map((j: any) => j.name),
    };
  }

  async searchNotes(params: SearchNotesParams): Promise<SearchNotesResponse> {
    // Use the existing search functionality with query string parsing
    const results = await this.client.documents.search({
      journals: [], // empty array means all journals
      texts: params.query ? [params.query] : undefined,
      limit: params.limit || 100,
      before: params.before,
    });

    const notes: NoteMetadata[] = results.data.map((item) => ({
      id: item.id,
      title: item.title,
      journal: item.journal,
      createdAt: item.createdAt,
      updatedAt: item.createdAt, // SearchItem doesn't have updatedAt, use createdAt
      tags: [], // TODO: Extract tags from document if needed
    }));

    return { notes };
  }

  async getNote(params: GetNoteParams): Promise<GetNoteResponse> {
    const doc = await this.client.documents.findById({ id: params.id });

    return {
      id: doc.id,
      title: doc.frontMatter.title,
      journal: doc.journal,
      content: doc.content,
      frontmatter: doc.frontMatter,
      createdAt: doc.frontMatter.createdAt,
      updatedAt: doc.frontMatter.updatedAt,
    };
  }

  async getNoteMetadata(params: GetNoteMetadataParams): Promise<NoteMetadata> {
    const doc = await this.client.documents.findById({ id: params.id });

    return {
      id: doc.id,
      title: doc.frontMatter.title,
      journal: doc.journal,
      createdAt: doc.frontMatter.createdAt,
      updatedAt: doc.frontMatter.updatedAt,
      tags: doc.frontMatter.tags || [],
    };
  }

  async createNote(params: CreateNoteParams): Promise<CreateNoteResponse> {
    const frontMatter = {
      title: params.frontmatter?.title,
      tags: params.frontmatter?.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...params.frontmatter,
    };

    const [id, docPath] = await this.client.documents.createDocument({
      journal: params.journal,
      content: params.content,
      frontMatter,
    });

    return {
      id,
      title: frontMatter.title,
      journal: params.journal,
      createdAt: frontMatter.createdAt,
    };
  }

  async updateNote(params: UpdateNoteParams): Promise<UpdateNoteResponse> {
    // Get existing document first
    const existing = await this.client.documents.findById({ id: params.id });

    // Merge frontmatter
    const updatedFrontMatter = {
      ...existing.frontMatter,
      ...params.frontmatter,
      updatedAt: new Date().toISOString(),
    };

    await this.client.documents.updateDocument({
      id: params.id,
      journal: existing.journal,
      content: params.content ?? existing.content,
      frontMatter: updatedFrontMatter,
    });

    return {
      id: params.id,
      updatedAt: updatedFrontMatter.updatedAt,
    };
  }
}
