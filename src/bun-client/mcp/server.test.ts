import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { ContentLengthParser, encodeContentLengthMessage } from "./framing";

interface JsonRpcError {
  code: number;
  message: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

class MCPTestClient {
  private parser = new ContentLengthParser();
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private stderr = "";

  constructor(private child: ChildProcessWithoutNullStreams) {
    child.stdout.on("data", (chunk: Buffer) => {
      this.onStdout(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr += chunk.toString("utf8");
    });
    child.on("exit", (code, signal) => {
      const detail = `MCP server exited (code=${code}, signal=${signal})`;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`${detail}\n${this.stderr}`.trim()));
      }
      this.pending.clear();
    });
  }

  async initialize(): Promise<void> {
    const initResponse = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "chronicles-mcp-test",
        version: "0.1.0",
      },
    });

    if (!isRecord(initResponse)) {
      throw new Error("initialize response must be an object");
    }
    expect(initResponse.protocolVersion).toBe("2024-11-05");
    await this.notify("notifications/initialized", {});
  }

  async toolsList(): Promise<string[]> {
    const result = await this.request("tools/list", {});
    if (!isRecord(result) || !Array.isArray(result.tools)) {
      throw new Error("tools/list returned invalid payload");
    }
    return result.tools
      .filter((tool) => isRecord(tool) && typeof tool.name === "string")
      .map((tool) => tool.name as string);
  }

  async callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await this.request("tools/call", {
      name,
      arguments: args,
    });

    if (!isRecord(result)) {
      throw new Error("tools/call returned invalid payload");
    }

    if (result.isError === true) {
      const toolError = firstToolText(result) || "MCP tool returned an error";
      throw new Error(toolError);
    }

    if (result.structuredContent !== undefined) {
      return result.structuredContent as T;
    }

    const text = firstToolText(result);
    if (!text) {
      throw new Error("Missing tool response body");
    }
    return JSON.parse(text) as T;
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params,
    };

    const encoded = encodeContentLengthMessage(payload);
    const wrote = this.child.stdin.write(encoded);
    if (!wrote) {
      await onceDrain(this.child.stdin);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for MCP response to ${method}\n${this.stderr}`.trim(),
          ),
        );
      }, 10000);

      this.pending.set(id, { resolve, reject, timer });
    });
  }

  async notify(method: string, params: unknown): Promise<void> {
    const payload = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };
    const encoded = encodeContentLengthMessage(payload);
    const wrote = this.child.stdin.write(encoded);
    if (!wrote) {
      await onceDrain(this.child.stdin);
    }
  }

  stop() {
    this.child.kill("SIGTERM");
  }

  private onStdout(chunk: Buffer) {
    const frames = this.parser.push(chunk);
    for (const frame of frames) {
      const message = JSON.parse(frame.body);
      if (!isRecord(message) || typeof message.id !== "number") {
        continue;
      }

      const pending = this.pending.get(message.id);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.pending.delete(message.id);

      if (isRecord(message.error)) {
        pending.reject(this.toRpcError(message.error));
        continue;
      }
      pending.resolve(message.result);
    }
  }

  private toRpcError(error: Record<string, unknown>): Error {
    const asRpcError: JsonRpcError = {
      code: typeof error.code === "number" ? error.code : -32603,
      message:
        typeof error.message === "string" ? error.message : "Unknown RPC error",
    };
    return new Error(
      `RPC ${asRpcError.code}: ${asRpcError.message}\n${this.stderr}`.trim(),
    );
  }
}

function firstToolText(result: Record<string, unknown>): string | undefined {
  if (!Array.isArray(result.content)) return undefined;
  for (const block of result.content) {
    if (
      isRecord(block) &&
      block.type === "text" &&
      typeof block.text === "string"
    ) {
      return block.text;
    }
  }
  return undefined;
}

function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve) => {
    stream.once("drain", () => resolve());
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

let tempRoot = "";
let testClient: MCPTestClient;

beforeAll(async () => {
  tempRoot = mkdtempSync(path.join(tmpdir(), "chronicles-mcp-test-"));

  const notesDir = path.join(tempRoot, "notes");
  const settingsDir = path.join(tempRoot, "settings");
  const dbPath = path.join(tempRoot, "chronicles.db");
  const serverPath = path.resolve(import.meta.dir, "server.ts");

  const child = spawn(process.execPath, ["run", serverPath], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      CHRONICLES_NOTES_DIR: notesDir,
      CHRONICLES_SETTINGS_DIR: settingsDir,
      CHRONICLES_DB_PATH: dbPath,
    },
  });

  testClient = new MCPTestClient(child);
  await testClient.initialize();
});

afterAll(() => {
  testClient.stop();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("Chronicles MCP server", () => {
  test("supports note CRUD and search over stdio MCP", async () => {
    const tools = await testClient.toolsList();
    expect(tools).toContain("chronicles_note_create");
    expect(tools).toContain("chronicles_note_get");
    expect(tools).toContain("chronicles_note_update");
    expect(tools).toContain("chronicles_note_delete");
    expect(tools).toContain("chronicles_notes_search");

    const noteA = await testClient.callTool<{
      id: string;
      journal: string;
      content: string;
      frontMatter: { title?: string };
    }>("chronicles_note_create", {
      journal: "mcp-journal",
      content: "alpha-token shared-token first note",
      title: "First MCP Note",
      tags: ["first", "shared-token"],
    });

    const fetchedA = await testClient.callTool<{
      id: string;
      content: string;
      frontMatter: { title?: string };
    }>("chronicles_note_get", { id: noteA.id });
    expect(fetchedA.id).toBe(noteA.id);
    expect(fetchedA.content).toContain("alpha-token");
    expect(fetchedA.frontMatter.title).toBe("First MCP Note");

    const noteB = await testClient.callTool<{
      id: string;
      content: string;
      frontMatter: { title?: string };
    }>("chronicles_note_create", {
      journal: "mcp-journal",
      content: "beta-token shared-token second note",
      title: "Second MCP Note",
      tags: ["second", "shared-token"],
    });
    expect(noteB.id).toBeString();
    expect(noteB.content).toContain("beta-token");

    const onlyA = await testClient.callTool<{ data: Array<{ id: string }> }>(
      "chronicles_notes_search",
      {
        texts: ["alpha-token"],
      },
    );
    expect(onlyA.data).toHaveLength(1);
    expect(onlyA.data[0].id).toBe(noteA.id);

    const onlyB = await testClient.callTool<{ data: Array<{ id: string }> }>(
      "chronicles_notes_search",
      {
        texts: ["beta-token"],
      },
    );
    expect(onlyB.data).toHaveLength(1);
    expect(onlyB.data[0].id).toBe(noteB.id);

    const either = await testClient.callTool<{ data: Array<{ id: string }> }>(
      "chronicles_notes_search",
      {
        texts: ["shared-token"],
      },
    );
    const ids = either.data.map((item) => item.id);
    expect(ids).toContain(noteA.id);
    expect(ids).toContain(noteB.id);

    const updatedA = await testClient.callTool<{
      id: string;
      content: string;
      frontMatter: { title?: string; tags?: string[] };
    }>("chronicles_note_update", {
      id: noteA.id,
      content: "alpha-token shared-token updated note body",
      title: "First MCP Note (Updated)",
      tags: ["first", "updated", "shared-token"],
    });
    expect(updatedA.content).toContain("updated note body");
    expect(updatedA.frontMatter.title).toBe("First MCP Note (Updated)");
    expect(updatedA.frontMatter.tags).toContain("updated");

    const fetchedUpdatedA = await testClient.callTool<{
      id: string;
      content: string;
      frontMatter: { title?: string };
    }>("chronicles_note_get", { id: noteA.id });
    expect(fetchedUpdatedA.content).toContain("updated note body");
    expect(fetchedUpdatedA.frontMatter.title).toBe("First MCP Note (Updated)");

    const deletedB = await testClient.callTool<{
      deleted: boolean;
      id: string;
    }>("chronicles_note_delete", {
      id: noteB.id,
    });
    expect(deletedB.deleted).toBe(true);
    expect(deletedB.id).toBe(noteB.id);

    const searchAfterDelete = await testClient.callTool<{
      data: Array<{ id: string }>;
    }>("chronicles_notes_search", {
      texts: ["beta-token"],
    });
    expect(searchAfterDelete.data).toHaveLength(0);
  });
});
