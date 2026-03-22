# Bun Client

**Status:** Complete — ported to `src/node-client/` for Electron. See [electron-modernization.md](electron-modernization.md).

Built a v2 `IClient` under Bun with no Electron dependencies (`src/bun-client/`). Drizzle ORM + `bun:sqlite`, 10 test files, 106 passing tests. Proved the cleaved backend architecture which was then ported to Node.js for the Electron modernization.

The bun-client code remains in-tree as the canonical Bun implementation (used by MCP server). The node-client shares schema and migrations via symlinks.
