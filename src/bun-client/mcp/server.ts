import path from "path";
import type { FrontMatter, SearchRequest } from "../../preload/client/types";
import { createClient, type BunClient } from "../factory";
import {
  ContentLengthParser,
  encodeContentLengthMessage,
  isRecord,
} from "./framing";

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "chronicles-mcp",
  version: "0.1.0",
};

const TOOL_DEFINITIONS: ToolDescriptor[] = [
  {
    name: "chronicles_note_create",
    description:
      "Create a note in a journal. Journal is created automatically if missing.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        journal: { type: "string" },
        content: { type: "string" },
        title: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
        frontMatter: { type: "object" },
      },
      required: ["journal", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "chronicles_note_get",
    description: "Fetch a note by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "chronicles_note_update",
    description:
      "Update a note by id. Fields are partial; omitted fields keep existing values.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        journal: { type: "string" },
        content: { type: "string" },
        title: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
        frontMatter: { type: "object" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "chronicles_note_delete",
    description: "Delete a note by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        journal: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "chronicles_notes_search",
    description:
      "Search notes. Use 'texts' for exact term matching or 'query' for a space-separated shorthand that splits into text terms. Also supports journal, title, tags, and date filters.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        ids: { type: "array", items: { type: "string" } },
        journals: { type: "array", items: { type: "string" } },
        titles: { type: "array", items: { type: "string" } },
        texts: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        before: { type: "string" },
        date: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
];

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

class ChroniclesMcpServer {
  private parser = new ContentLengthParser();
  private clientPromise: Promise<BunClient> | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private knownJournals = new Set<string>();

  start() {
    this.redirectStdoutLogsToStderr();
    process.stdin.on("data", (chunk) => {
      this.handleInput(chunk);
    });
    process.stdin.on("error", (err) => {
      console.error("[chronicles-mcp] stdin error:", err);
    });
    process.stdin.resume();
  }

  private handleInput(chunk: Buffer | Uint8Array) {
    let frames;
    try {
      frames = this.parser.push(chunk);
    } catch (err) {
      this.sendError(null, -32700, errorMessage(err));
      return;
    }

    for (const frame of frames) {
      this.handleFrame(frame.body);
    }
  }

  private handleFrame(body: string) {
    let message: unknown;
    try {
      message = JSON.parse(body);
    } catch {
      this.sendError(null, -32700, "Parse error");
      return;
    }

    if (Array.isArray(message)) {
      for (const entry of message) {
        this.handleMessage(entry);
      }
      return;
    }

    this.handleMessage(message);
  }

  private handleMessage(message: unknown) {
    if (!isRecord(message)) {
      this.sendError(null, -32600, "Invalid request");
      return;
    }

    const request: JsonRpcRequest = message as JsonRpcRequest;
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      this.sendError(request.id ?? null, -32600, "Invalid request");
      return;
    }

    // Notification: no id means no response.
    if (request.id === undefined) {
      return;
    }

    void this.handleRequest(request);
  }

  private async handleRequest(request: JsonRpcRequest) {
    try {
      const result = await this.dispatchRequest(request.method, request.params);
      this.sendResponse(request.id ?? null, result);
    } catch (err) {
      if (err instanceof RpcError) {
        this.sendError(request.id ?? null, err.code, err.message, err.data);
        return;
      }

      this.sendError(request.id ?? null, -32603, errorMessage(err));
    }
  }

  private async dispatchRequest(method: string, params: unknown) {
    switch (method) {
      case "initialize":
        return this.handleInitialize(params);
      case "ping":
        return {};
      case "tools/list":
        return { tools: TOOL_DEFINITIONS };
      case "tools/call":
        return this.handleToolCall(params);
      default:
        throw new RpcError(-32601, `Method not found: ${method}`);
    }
  }

  private handleInitialize(params: unknown) {
    if (!isRecord(params)) {
      throw new RpcError(-32602, "initialize params must be an object");
    }

    if (
      "protocolVersion" in params &&
      typeof params.protocolVersion === "string"
    ) {
      this.protocolVersion = params.protocolVersion;
    }

    return {
      protocolVersion: this.protocolVersion,
      capabilities: {
        tools: {},
      },
      serverInfo: SERVER_INFO,
    };
  }

  private async handleToolCall(params: unknown): Promise<ToolResponse> {
    if (!isRecord(params)) {
      throw new RpcError(-32602, "tools/call params must be an object");
    }

    const name = requiredString(params, "name");
    const args = optionalRecord(params, "arguments") ?? {};

    try {
      const payload = await this.runTool(name, args);
      return toolSuccess(payload);
    } catch (err) {
      return toolFailure(errorMessage(err));
    }
  }

  private async runTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "chronicles_note_create":
        return this.createNote(args);
      case "chronicles_note_get":
        return this.getNote(args);
      case "chronicles_note_update":
        return this.updateNote(args);
      case "chronicles_note_delete":
        return this.deleteNote(args);
      case "chronicles_notes_search":
        return this.searchNotes(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async createNote(args: Record<string, unknown>) {
    const client = await this.getClient();
    const now = new Date().toISOString();

    const journal = requiredString(args, "journal");
    const content = requiredString(args, "content");
    const id = optionalString(args, "id");
    const userFrontMatter = optionalRecord(args, "frontMatter") ?? {};
    const title =
      optionalString(args, "title") ?? optionalString(userFrontMatter, "title");
    const tags =
      optionalStringArray(args, "tags") ??
      optionalStringArray(userFrontMatter, "tags") ??
      [];
    const createdAt =
      optionalString(args, "createdAt") ??
      optionalString(userFrontMatter, "createdAt") ??
      now;
    const updatedAt =
      optionalString(args, "updatedAt") ??
      optionalString(userFrontMatter, "updatedAt") ??
      now;

    const frontMatter: FrontMatter = {
      ...userFrontMatter,
      title,
      tags,
      createdAt,
      updatedAt,
    };

    await this.ensureJournalExists(journal);

    const [createdId] = await client.documents.createDocument({
      id,
      journal,
      content,
      frontMatter,
    });

    return client.documents.findById({ id: createdId });
  }

  private async getNote(args: Record<string, unknown>) {
    const client = await this.getClient();
    const id = requiredString(args, "id");
    return client.documents.findById({ id });
  }

  private async updateNote(args: Record<string, unknown>) {
    const client = await this.getClient();
    const now = new Date().toISOString();
    const id = requiredString(args, "id");

    const current = await client.documents.findById({ id });
    const userFrontMatter = optionalRecord(args, "frontMatter") ?? {};

    const journal = optionalString(args, "journal") ?? current.journal;
    const content = optionalString(args, "content") ?? current.content;
    const title =
      optionalString(args, "title") ??
      optionalString(userFrontMatter, "title") ??
      current.frontMatter.title;
    const tags =
      optionalStringArray(args, "tags") ??
      optionalStringArray(userFrontMatter, "tags") ??
      current.frontMatter.tags ??
      [];
    const createdAt =
      optionalString(args, "createdAt") ??
      optionalString(userFrontMatter, "createdAt") ??
      current.frontMatter.createdAt ??
      now;
    const updatedAt =
      optionalString(args, "updatedAt") ??
      optionalString(userFrontMatter, "updatedAt") ??
      now;

    const mergedFrontMatter: FrontMatter = {
      ...current.frontMatter,
      ...userFrontMatter,
      title,
      tags,
      createdAt,
      updatedAt,
    };

    await this.ensureJournalExists(journal);
    await client.documents.updateDocument({
      id,
      journal,
      content,
      frontMatter: mergedFrontMatter,
    });
    return client.documents.findById({ id });
  }

  private async deleteNote(args: Record<string, unknown>) {
    const client = await this.getClient();
    const id = requiredString(args, "id");

    const journal =
      optionalString(args, "journal") ??
      (await client.documents.findById({ id })).journal;

    await client.documents.del(id, journal);
    return { id, deleted: true };
  }

  private async searchNotes(args: Record<string, unknown>) {
    const client = await this.getClient();

    const query = optionalString(args, "query");
    const explicitTexts = optionalStringArray(args, "texts");
    const textTerms =
      explicitTexts ??
      (query ? query.split(/\s+/).map((token) => token.trim()) : undefined);
    const cleanedTexts = textTerms?.filter(Boolean);

    const request: SearchRequest = {};
    const ids = optionalStringArray(args, "ids");
    const journals = optionalStringArray(args, "journals");
    const titles = optionalStringArray(args, "titles");
    const tags = optionalStringArray(args, "tags");
    const before = optionalString(args, "before");
    const date = optionalString(args, "date");
    const limit = optionalPositiveInteger(args, "limit");

    if (ids?.length) request.ids = ids;
    if (journals?.length) request.journals = journals;
    if (titles?.length) request.titles = titles;
    if (cleanedTexts?.length) request.texts = cleanedTexts;
    if (tags?.length) request.tags = tags;
    if (before) request.before = before;
    if (date) request.date = date;
    if (limit) request.limit = limit;

    return client.documents.search(request);
  }

  private async getClient(): Promise<BunClient> {
    if (!this.clientPromise) {
      const paths = resolveClientPaths();
      this.clientPromise = createClient(paths);
    }
    return this.clientPromise;
  }

  private async ensureJournalExists(journalName: string) {
    if (this.knownJournals.has(journalName)) return;

    const client = await this.getClient();
    const journals = await client.journals.list();
    for (const j of journals) this.knownJournals.add(j.name);

    if (!this.knownJournals.has(journalName)) {
      await client.journals.create({ name: journalName });
      this.knownJournals.add(journalName);
    }
  }

  private sendResponse(id: JsonRpcId, result: unknown) {
    this.send({
      jsonrpc: "2.0",
      id,
      result,
    });
  }

  private sendError(
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown,
  ) {
    const error: JsonRpcErrorObject = { code, message };
    if (data !== undefined) error.data = data;

    this.send({
      jsonrpc: "2.0",
      id,
      error,
    });
  }

  private send(message: unknown) {
    process.stdout.write(encodeContentLengthMessage(message));
  }

  private redirectStdoutLogsToStderr() {
    console.log = (...args: unknown[]) => {
      process.stderr.write(`${args.map((arg) => String(arg)).join(" ")}\n`);
    };
  }
}

function resolveClientPaths() {
  const home = process.env.HOME || process.cwd();
  const dataDir = path.join(home, "Library", "Application Support", "Electron");

  return {
    notesDir: process.env.CHRONICLES_NOTES_DIR || path.join(dataDir, "notes"),
    settingsDir: process.env.CHRONICLES_SETTINGS_DIR || dataDir,
    dbPath:
      process.env.CHRONICLES_DB_PATH || path.join(dataDir, "chronicles.db"),
  };
}

function requiredString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field];
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${field} must be a string`);
}

function optionalString(
  obj: Record<string, unknown>,
  field: string,
): string | undefined {
  if (!(field in obj)) return undefined;
  const value = obj[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function optionalStringArray(
  obj: Record<string, unknown>,
  field: string,
): string[] | undefined {
  if (!(field in obj)) return undefined;
  const value = obj[field];
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function optionalPositiveInteger(
  obj: Record<string, unknown>,
  field: string,
): number | undefined {
  if (!(field in obj)) return undefined;
  const value = obj[field];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value as number;
}

function optionalRecord(
  obj: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  if (!(field in obj)) return undefined;
  const value = obj[field];
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function toolSuccess(data: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function toolFailure(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const server = new ChroniclesMcpServer();
server.start();
