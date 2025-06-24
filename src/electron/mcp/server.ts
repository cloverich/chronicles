/**
 * Chronicles MCP Server
 *
 * JSON-RPC 2.0 server over Unix socket for exposing Chronicles functionality
 * to AI tools like Claude Code and Cursor.
 */

import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import { MCPBridge } from "./bridge";
import {
  JsonRpcError,
  JsonRpcErrorCode,
  JsonRpcRequest,
  JsonRpcResponse,
  MCPServerConfig,
  MCP_METHODS,
} from "./types";

export class MCPServer {
  private server: net.Server | null = null;
  private bridge: MCPBridge;
  private config: MCPServerConfig;
  private isRunning = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.bridge = new MCPBridge();
  }

  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    try {
      // Clean up existing socket file if it exists
      if (fs.existsSync(this.config.socketPath)) {
        fs.unlinkSync(this.config.socketPath);
      }

      // Ensure socket directory exists
      const socketDir = path.dirname(this.config.socketPath);
      if (!fs.existsSync(socketDir)) {
        fs.mkdirSync(socketDir, { recursive: true });
      }

      this.server = net.createServer((socket) => {
        console.log("MCP client connected");

        let buffer = "";

        socket.on("data", (data) => {
          buffer += data.toString();

          // Process complete JSON-RPC messages (one per line)
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              this.handleRequest(line.trim(), socket);
            }
          }
        });

        socket.on("close", () => {
          console.log("MCP client disconnected");
        });

        socket.on("error", (err) => {
          console.error("MCP socket error:", err);
        });
      });

      this.server.listen(this.config.socketPath, () => {
        console.log(`MCP server listening on ${this.config.socketPath}`);
        this.isRunning = true;
      });

      this.server.on("error", (err) => {
        console.error("MCP server error:", err);
        this.isRunning = false;
      });
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        // Clean up socket file
        if (fs.existsSync(this.config.socketPath)) {
          fs.unlinkSync(this.config.socketPath);
        }

        this.isRunning = false;
        console.log("MCP server stopped");
        resolve();
      });
    });
  }

  private async handleRequest(
    message: string,
    socket: net.Socket,
  ): Promise<void> {
    let request: JsonRpcRequest;

    try {
      request = JSON.parse(message);
    } catch (error) {
      const response = this.createErrorResponse(
        null,
        JsonRpcErrorCode.PARSE_ERROR,
        "Parse error",
        { detail: "Invalid JSON" },
      );
      this.sendResponse(socket, response);
      return;
    }

    // Validate JSON-RPC 2.0 format
    if (request.jsonrpc !== "2.0" || !request.method) {
      const response = this.createErrorResponse(
        request.id || null,
        JsonRpcErrorCode.INVALID_REQUEST,
        "Invalid Request",
        { detail: "Missing required fields" },
      );
      this.sendResponse(socket, response);
      return;
    }

    try {
      const result = await this.handleMethod(request.method, request.params);
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        result,
        id: request.id || null,
      };
      this.sendResponse(socket, response);
    } catch (error) {
      console.error(`MCP method error (${request.method}):`, error);

      let errorCode = JsonRpcErrorCode.INTERNAL_ERROR;
      let errorMessage = "Internal error";
      let errorData: any = {};

      if (error instanceof Error) {
        errorMessage = error.message;
        // TODO: Map specific error types to appropriate error codes
        if (
          error.message.includes("not found") ||
          error.message.includes("Not found")
        ) {
          errorCode = JsonRpcErrorCode.NOT_FOUND;
        } else if (
          error.message.includes("validation") ||
          error.message.includes("invalid")
        ) {
          errorCode = JsonRpcErrorCode.VALIDATION_ERROR;
        }

        errorData = {
          type: "https://chronicles.app/errors/internal-error",
          title: errorMessage,
          detail: error.message,
          instance: `/${request.method}`,
        };
      }

      const response = this.createErrorResponse(
        request.id || null,
        errorCode,
        errorMessage,
        errorData,
      );
      this.sendResponse(socket, response);
    }
  }

  private async handleMethod(method: string, params: any): Promise<any> {
    switch (method) {
      case MCP_METHODS.PING:
        return await this.bridge.ping();

      case MCP_METHODS.LIST_JOURNALS:
        return await this.bridge.listJournals();

      case MCP_METHODS.SEARCH_NOTES:
        if (!params?.query) {
          throw new Error("Missing required parameter: query");
        }
        return await this.bridge.searchNotes(params);

      case MCP_METHODS.GET_NOTE:
        if (!params?.id) {
          throw new Error("Missing required parameter: id");
        }
        return await this.bridge.getNote(params);

      case MCP_METHODS.GET_NOTE_METADATA:
        if (!params?.id) {
          throw new Error("Missing required parameter: id");
        }
        return await this.bridge.getNoteMetadata(params);

      case MCP_METHODS.CREATE_NOTE:
        if (!params?.journal || !params?.content) {
          throw new Error("Missing required parameters: journal, content");
        }
        return await this.bridge.createNote(params);

      case MCP_METHODS.UPDATE_NOTE:
        if (!params?.id) {
          throw new Error("Missing required parameter: id");
        }
        if (!params.content && !params.frontmatter) {
          throw new Error(
            "Must provide either content or frontmatter to update",
          );
        }
        return await this.bridge.updateNote(params);

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  private createErrorResponse(
    id: string | number | null,
    code: JsonRpcErrorCode,
    message: string,
    data?: any,
  ): JsonRpcResponse {
    const error: JsonRpcError = {
      code,
      message,
      ...(data && { data }),
    };

    return {
      jsonrpc: "2.0",
      error,
      id,
    };
  }

  private sendResponse(socket: net.Socket, response: JsonRpcResponse): void {
    const message = JSON.stringify(response) + "\n";
    socket.write(message);
  }

  get running(): boolean {
    return this.isRunning;
  }
}

// Default configuration factory
export function createDefaultMCPConfig(): MCPServerConfig {
  const homeDir = os.homedir();
  const chroniclesDir = path.join(homeDir, ".chronicles");

  return {
    enabled: false, // Disabled by default
    socketPath: path.join(chroniclesDir, "mcp.sock"),
    httpPort: undefined, // Unix socket only for now
    authToken: undefined, // No auth for local socket
  };
}
