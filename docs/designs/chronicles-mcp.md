# Design Doc: Chronicles MCP Server (stdio)

## Rationale

The CLI commands map 1:1 to MCP tools, making MCP a natural surface on top of
the node client. stdio transport was chosen over HTTP because MCP hosts (Claude,
Codex, Gemini CLI, etc.) spawn servers as child processes — no port management
needed.

See [chronicles-cli.md](chronicles-cli.md) §7 for the original design notes.

## Implementation

The MCP server lives in `src/mcp/` and uses the node-client (`better-sqlite3` +
Drizzle). It is bundled by esbuild into a single `mcp-server.bundle.mjs` file
that runs with plain `node` — no additional runtime (Bun, tsx) required.

**Available tools:** `chronicles_note_create`, `chronicles_note_get`,
`chronicles_note_update`, `chronicles_note_delete`, `chronicles_notes_search`.

**Environment variables** (all optional, sensible defaults for macOS):

- `CHRONICLES_DB_PATH` — SQLite database location
- `CHRONICLES_NOTES_DIR` — Notes root directory
- `CHRONICLES_SETTINGS_DIR` — Settings directory

The app does **not** need to be running. The MCP server opens the SQLite
database directly (WAL mode handles concurrent access).

### Build & packaging

The esbuild config in `scripts/build-main-preload.js` produces three bundles:

1. `main.bundle.mjs` — Electron main process
2. `preload.bundle.mjs` — Electron preload
3. `mcp-server.bundle.mjs` — standalone MCP server

`build.sh` copies all three into `dist/`, which gets packaged into the app.
In the final `.app` bundle the MCP server is at:

```
Chronicles.app/Contents/Resources/app/mcp-server.bundle.mjs
```

### Preferences UI

The Settings dialog includes an "AI Integration (MCP)" section with copyable
config snippets for Claude Code, Claude Desktop, Gemini CLI, and Codex CLI.
The snippets auto-populate the correct path to the bundled server.

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

**Gemini CLI** (`~/.gemini/settings.json`):

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

**Codex CLI**:

```bash
codex mcp add chronicles -- node "/Applications/Chronicles.app/Contents/Resources/app/mcp-server.bundle.mjs"
```

**Dev mode** (from repo root):

```bash
node scripts/build-main-preload.js && node src/mcp-server.bundle.mjs
```

Or use the config snippets from the app's preferences UI, which resolve the
correct path automatically.
