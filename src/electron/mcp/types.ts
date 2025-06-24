/**
 * MCP Server Types for Chronicles
 *
 * JSON-RPC 2.0 request/response types and MCP-specific interfaces
 */

// JSON-RPC 2.0 Base Types
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: JsonRpcErrorData;
}

// RFC 7807-style error data
export interface JsonRpcErrorData {
  type?: string;
  title?: string;
  detail?: string;
  instance?: string;
  invalid_params?: string[];
}

// MCP Method Parameters
export interface SearchNotesParams {
  query: string;
  limit?: number;
  before?: string;
}

export interface GetNoteParams {
  id: string;
}

export interface GetNoteMetadataParams {
  id: string;
}

export interface CreateNoteParams {
  journal: string;
  content: string;
  frontmatter?: Record<string, any>;
}

export interface UpdateNoteParams {
  id: string;
  content?: string;
  frontmatter?: Record<string, any>;
}

// MCP Response Types
export interface ListJournalsResponse {
  journals: string[];
}

export interface SearchNotesResponse {
  notes: NoteMetadata[];
}

export interface NoteMetadata {
  id: string;
  title?: string;
  journal: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface GetNoteResponse {
  id: string;
  title?: string;
  journal: string;
  content: string;
  frontmatter: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteResponse {
  id: string;
  title?: string;
  journal: string;
  createdAt: string;
}

export interface UpdateNoteResponse {
  id: string;
  updatedAt: string;
}

export interface PingResponse {
  status: "ok";
  version: string;
  uptime: number;
}

// MCP Server Configuration
export interface MCPServerConfig {
  enabled: boolean;
  socketPath: string;
  httpPort?: number;
  authToken?: string;
}

// Standard JSON-RPC Error Codes
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Application-specific error codes
  SERVICE_UNAVAILABLE = -32001,
  VALIDATION_ERROR = -32002,
  NOT_FOUND = -32003,
  PERMISSION_DENIED = -32004,
}

export const MCP_METHODS = {
  PING: "ping",
  LIST_JOURNALS: "listJournals",
  SEARCH_NOTES: "searchNotes",
  GET_NOTE: "getNote",
  GET_NOTE_METADATA: "getNoteMetadata",
  CREATE_NOTE: "createNote",
  UPDATE_NOTE: "updateNote",
} as const;

export type MCPMethod = (typeof MCP_METHODS)[keyof typeof MCP_METHODS];
