/**
 * Chronicles MCP Server
 *
 * JSON-RPC 2.0 server over Unix socket for exposing Chronicles functionality
 * to AI tools like Claude Code and Cursor.
 */

const net = require("net");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { MCPBridge } = require("./bridge");

const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Application-specific error codes
  SERVICE_UNAVAILABLE: -32001,
  VALIDATION_ERROR: -32002,
  NOT_FOUND: -32003,
  PERMISSION_DENIED: -32004,
};

const MCP_METHODS = {
  PING: "ping",
  LIST_JOURNALS: "listJournals",
  SEARCH_NOTES: "searchNotes",
  GET_NOTE: "getNote",
  GET_NOTE_METADATA: "getNoteMetadata",
  CREATE_NOTE: "createNote",
  UPDATE_NOTE: "updateNote",
};

class MCPServer {
  constructor(config) {
    this.config = config;
    this.bridge = new MCPBridge();
    this.server = null;
    this.isRunning = false;
    this.startTime = Date.now();
  }

  async start() {
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

  async stop() {
    if (!this.server || !this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
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

  async handleRequest(message, socket) {
    let request;

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
      const response = {
        jsonrpc: "2.0",
        result,
        id: request.id || null,
      };
      this.sendResponse(socket, response);
    } catch (error) {
      console.error(`MCP method error (${request.method}):`, error);

      let errorCode = JsonRpcErrorCode.INTERNAL_ERROR;
      let errorMessage = "Internal error";
      let errorData = {};

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

  async handleMethod(method, params) {
    switch (method) {
      case MCP_METHODS.PING:
        return {
          status: "ok",
          version: "1.0.0", // TODO: Get from package.json
          uptime: Date.now() - this.startTime,
        };

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

  createErrorResponse(id, code, message, data) {
    const error = {
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

  sendResponse(socket, response) {
    const message = JSON.stringify(response) + "\n";
    socket.write(message);
  }

  get running() {
    return this.isRunning;
  }
}

// Default configuration factory
function createDefaultMCPConfig() {
  const homeDir = os.homedir();
  const chroniclesDir = path.join(homeDir, ".chronicles");

  return {
    enabled: false, // Disabled by default
    socketPath: path.join(chroniclesDir, "mcp.sock"),
    httpPort: undefined, // Unix socket only for now
    authToken: undefined, // No auth for local socket
  };
}

module.exports = { MCPServer, createDefaultMCPConfig };
