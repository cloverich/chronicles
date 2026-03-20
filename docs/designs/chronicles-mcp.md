# Design Doc: Chronicles MCP Server (stdio)

This document describes how to run and register the Chronicles MCP server
implemented in `src/bun-client/mcp/`.

## Scope

- Transport: stdio pipes (no HTTP server required)
- Backing runtime: Bun client (`src/bun-client/factory.ts`)
- Implemented tools:
  - `chronicles_note_create`
  - `chronicles_note_get`
  - `chronicles_note_update`
  - `chronicles_note_delete`
  - `chronicles_notes_search`

## Prerequisites

- `bun` installed
- Repository checked out
- Dependencies installed (`yarn` or `bun install`)

## Run The MCP Server

From repo root:

```bash
bun run mcp:server
```

Equivalent direct command:

```bash
bun run src/bun-client/mcp/server.ts
```

Supported environment variables:

- `CHRONICLES_DB_PATH` (default: `~/Library/Application Support/Electron/chronicles.db`)
- `CHRONICLES_NOTES_DIR` (default: `~/Library/Application Support/Electron/notes`)
- `CHRONICLES_SETTINGS_DIR` (default: `~/Library/Application Support/Electron`)

## Validate End-to-End MCP Behavior

Run the MCP integration test:

```bash
bun test src/bun-client/mcp/server.test.ts
```

The test talks to the server over stdio MCP and verifies:

1. create note A
2. read note A
3. create note B
4. search A only
5. search B only
6. search either
7. update A
8. read updated A
9. delete B

## Register In Codex CLI

Codex can manage external MCP servers directly.

Register server:

```bash
REPO=/Users/cloverich/code/chronicles
codex mcp add chronicles -- \
  bun run "$REPO/src/bun-client/mcp/server.ts"
```

Register server with explicit Chronicles data paths:

```bash
REPO=/Users/cloverich/code/chronicles
codex mcp remove chronicles 2>/dev/null || true
codex mcp add chronicles \
  --env CHRONICLES_NOTES_DIR="$HOME/Library/Application Support/Electron/notes" \
  --env CHRONICLES_DB_PATH="$HOME/Library/Application Support/Electron/chronicles.db" \
  --env CHRONICLES_SETTINGS_DIR="$HOME/Library/Application Support/Electron" \
  -- bun run "$REPO/src/bun-client/mcp/server.ts"
```

Inspect registration:

```bash
codex mcp list
codex mcp get chronicles --json
```

## Use From Codex

After registration, start a new Codex thread/session and ask it to use the
Chronicles MCP tools. Example:

```text
Use the chronicles MCP tools to create a note in mcp-journal, read it, create another,
search first/second/either, update first, and read back.
```

Note: existing in-flight sessions may not pick up newly registered MCP servers.
If tools do not appear, start a fresh session.
