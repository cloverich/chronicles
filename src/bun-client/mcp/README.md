# Chronicles MCP Server (stdio)

This server exposes basic note operations over MCP using stdio pipes.

## Run

```bash
bun run mcp:server
```

## Environment

- `CHRONICLES_DB_PATH` — SQLite path (default: `~/Library/Application Support/Electron/chronicles.db`)
- `CHRONICLES_NOTES_DIR` — notes root (default: `~/Library/Application Support/Electron/notes`)
- `CHRONICLES_SETTINGS_DIR` — settings dir (default: `~/Library/Application Support/Electron`)

## Tools

- `chronicles_note_create`
- `chronicles_note_get`
- `chronicles_note_update`
- `chronicles_note_delete`
- `chronicles_notes_search`

`create`/`update` auto-create journals when needed.

## Validation

End-to-end stdio test:

```bash
bun test src/bun-client/mcp/server.test.ts
```
