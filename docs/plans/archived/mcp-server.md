# Chronicles MCP Server (Bun Client Surface)

Build a basic stdio MCP server for Chronicles that reuses the Bun client with
minimal impact to the existing app.

## Goals

1. Add a standalone MCP server surface that uses `src/bun-client/factory.ts`
   without requiring significant Bun client changes.
2. Use stdio/pipe transport (no HTTP server).
3. Support and verify note CRUD + search through MCP calls:
   - create note
   - read note
   - create another note
   - search first only, second only, either
   - update one note and read updated value back

## Scope

- New code should live under a new folder in the Bun client surface:
  `src/bun-client/mcp/`.
- Keep touch points outside this folder minimal (`package.json` script,
  `AGENTS.md` link, docs as needed).

## Design

### Transport

- Implement JSON-RPC over stdio with `Content-Length` framing.
- Handle MCP core methods:
  - `initialize`
  - `tools/list`
  - `tools/call`
  - `ping`
- Ignore notifications such as `notifications/initialized`.

### Runtime

- Lazily create one Bun client instance per server process via `createClient()`.
- Runtime paths come from env vars (with sensible defaults):
  - `CHRONICLES_DB_PATH`
  - `CHRONICLES_NOTES_DIR`
  - `CHRONICLES_SETTINGS_DIR`

### Tools

- `chronicles_note_create`
- `chronicles_note_get`
- `chronicles_note_update`
- `chronicles_note_delete`
- `chronicles_notes_search`

Implementation details:

- Note create/update auto-create missing journal by name.
- Tool results return MCP text content plus `structuredContent` for machine use.

## Validation

Create an end-to-end Bun test that:

1. Spawns MCP server as a subprocess over stdio.
2. Sends MCP `initialize`, then `tools/list`.
3. Executes the full workflow:
   - create note A
   - read note A
   - create note B
   - search A only
   - search B only
   - search either A or B
   - update A
   - read A and verify update
   - delete B and verify absence (covers delete in CRUD)
4. Uses temporary db/notes/settings dirs so tests are isolated.

## Exit Criteria

- MCP server starts via a single command/script.
- E2E MCP test passes and proves the required note/search workflow.
- Existing Bun client tests continue to pass for touched areas.
