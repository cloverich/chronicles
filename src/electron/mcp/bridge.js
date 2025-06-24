/**
 * MCP Bridge - Reuses existing preload clients for MCP server operations
 *
 * This bridge creates the same client structure used in the preload context
 * but runs in the main process for the MCP server to use.
 */

const DB = require("better-sqlite3");
const Knex = require("knex");
const Store = require("electron-store");
const { DocumentsClient } = require("../../preload/client/documents");
const { FilesClient } = require("../../preload/client/files");
const { JournalsClient } = require("../../preload/client/journals");
const { PreferencesClient } = require("../../preload/client/preferences");
const { TagsClient } = require("../../preload/client/tags");

class MCPBridge {
  constructor() {
    this.startTime = Date.now();

    // Recreate the same client setup as in preload/client/index.ts
    const settings = new Store({
      name: "settings",
    });

    const db = DB(settings.get("databaseUrl"));
    const knex = Knex({
      client: "better-sqlite3",
      connection: {
        filename: settings.get("databaseUrl"),
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
    };
  }

  async ping() {
    return {
      status: "ok",
      version: "1.0.0", // TODO: Get from package.json
      uptime: Date.now() - this.startTime,
    };
  }

  async listJournals() {
    const journals = await this.client.journals.list();
    return {
      journals: journals.map((j) => j.name),
    };
  }

  async searchNotes(params) {
    // Use the existing search functionality with query string parsing
    const results = await this.client.documents.search({
      journals: [], // empty array means all journals
      texts: params.query ? [params.query] : undefined,
      limit: params.limit || 100,
      before: params.before,
    });

    const notes = results.data.map((item) => ({
      id: item.id,
      title: item.title,
      journal: item.journal,
      createdAt: item.createdAt,
      updatedAt: item.createdAt, // SearchItem doesn't have updatedAt, use createdAt
      tags: [], // TODO: Extract tags from document if needed
    }));

    return { notes };
  }

  async getNote(params) {
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

  async getNoteMetadata(params) {
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

  async createNote(params) {
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

  async updateNote(params) {
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

module.exports = { MCPBridge };
