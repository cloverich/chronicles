# Design Doc: Chronicles MCP Server (stdio)

## Rationale

The CLI commands map 1:1 to MCP tools, making MCP a natural surface on top of
the Bun client. stdio transport was chosen over HTTP because MCP hosts (Claude,
Codex, etc.) spawn servers as child processes — no port management needed.

See [chronicles-cli.md](chronicles-cli.md) §7 for the original design notes.

## Implementation

All code lives in `src/bun-client/mcp/`. See the
[README](../../src/bun-client/mcp/README.md) for usage, environment variables,
available tools, and how to run the test.

## Register as an MCP Server

Most AI tools accept stdio MCP servers with the same pattern: point them at
`bun run src/bun-client/mcp/server.ts` from the repo root.

**Claude Code** (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "chronicles": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/src/bun-client/mcp/server.ts"],
      "env": {
        "CHRONICLES_DB_PATH": "~/Library/Application Support/Electron/chronicles.db",
        "CHRONICLES_NOTES_DIR": "~/Library/Application Support/Electron/notes",
        "CHRONICLES_SETTINGS_DIR": "~/Library/Application Support/Electron"
      }
    }
  }
}
```

**Codex CLI**:

```bash
REPO=/path/to/chronicles
codex mcp add chronicles -- bun run "$REPO/src/bun-client/mcp/server.ts"
```

**Generic stdio**: any MCP host that supports `command`/`args` config works the
same way — just point at the entry script and set the env vars if the defaults
don't match your data location.
