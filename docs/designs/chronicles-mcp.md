# Design Doc: Chronicles MCP Server (stdio)

> **Status: Deferred.** The Node-based MCP server was removed because
> `better-sqlite3` requires separate native builds for Electron's ABI vs system
> Node's ABI — not worth the complexity for a stopgap. The design remains valid
> and can be revisited when one of these unblocks:
>
> - **Drizzle ships a `node:sqlite` driver** ([drizzle-team/drizzle-orm#5471](https://github.com/drizzle-team/drizzle-orm/issues/5471)) — eliminates the native module entirely
> - **Bun standalone binary** — `bun build --compile` with `bun:sqlite`, no native dep
> - **Swift backend** — HTTP-based MCP server, no Electron dependency
> - **Cloud backend** — HTTP MCP transport

## Rationale

The CLI commands map 1:1 to MCP tools, making MCP a natural surface on top of
the node client. stdio transport was chosen over HTTP because MCP hosts (Claude,
Codex, Gemini CLI, etc.) spawn servers as child processes — no port management
needed.

See [chronicles-cli.md](chronicles-cli.md) §7 for the original design notes.

## Tools

`chronicles_note_create`, `chronicles_note_get`,
`chronicles_note_update`, `chronicles_note_delete`, `chronicles_notes_search`.

## Environment variables (all optional, sensible defaults for macOS)

- `CHRONICLES_DB_PATH` — SQLite database location
- `CHRONICLES_NOTES_DIR` — Notes root directory
- `CHRONICLES_SETTINGS_DIR` — Settings directory

The app does **not** need to be running. The MCP server opens the SQLite
database directly (WAL mode handles concurrent access).

## Lessons learned

### Testing an MCP server locally

The original Bun server (`src/bun-client/mcp/server.test.ts`) had an E2E test
that spawned the server as a subprocess and exchanged JSON-RPC messages over
stdin/stdout. Key patterns:

1. **Spawn the process** with `stdio: ['pipe', 'pipe', 'pipe']`
2. **Send `initialize`** request, wait for response
3. **Send `tools/list`**, verify tool names
4. **Call a tool** via `tools/call`, assert the result content
5. **Clean up**: kill the process, delete the temp DB

**Framing gotcha:** The MCP spec says stdio uses NDJSON (one JSON object per
line, `\n`-delimited). Our first implementation used `Content-Length:\r\n\r\n`
framing (the LSP convention), which worked with some hosts but not others. The
correct framing for MCP stdio is plain NDJSON — no `Content-Length` headers.

### The native module problem

`better-sqlite3` compiles a `.node` native addon against a specific Node ABI.
Electron uses a different ABI than system Node. `electron-rebuild` recompiles
for Electron, but then the MCP server (which runs under system `node`) can't
load it. Shipping two copies of the native module is possible but ugly.
`node:sqlite` (built into Node 22+) would solve this, but Drizzle doesn't
support it yet.

## Register as an MCP Server

Most AI tools accept stdio MCP servers with the same pattern: point them at
`node /path/to/mcp-server.bundle.mjs`.

**Claude Code** (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "chronicles": {
      "command": "node",
      "args": [
        "/Applications/Chronicles.app/Contents/Resources/app/mcp-server.bundle.mjs"
      ]
    }
  }
}
```

**Claude Desktop**: Same JSON format in Claude Desktop's MCP settings.

**Gemini CLI** (`~/.gemini/settings.json`): Same JSON format.

**Codex CLI**:

```bash
codex mcp add chronicles -- node "/path/to/mcp-server.bundle.mjs"
```
