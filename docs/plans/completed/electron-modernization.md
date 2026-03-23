# Electron Backend Modernization

**Status:** Complete (2025-03-21)

Ported the bun-client architecture back to Electron's Node.js runtime after Electrobun was deferred (WKWebView CSP/fetch issues). The result: a cleaved, independently testable backend using Drizzle ORM + better-sqlite3.

## What was done

1. **`src/node-client/`** — Port of bun-client with `drizzle-orm/better-sqlite3`. Schema and migrations shared via symlinks. 10 modules, 10 test files, 106 tests.
2. **Preload wiring** — `src/preload/client/factory.ts` delegates to node-client. Async init (`initClient()` + `getClient()`). `IClient` no longer exposes `knex`.
3. **Legacy cleanup** — Deleted 5 `.electron-test.ts` files. Old preload modules still present but unused (can remove once node-client is proven in production).
4. **Lexical default** — `EditorMode.Editor` now renders Lexical; Plate available as alternate.
5. **Test runner** — `node:test` via `node --import tsx --test`. No vitest dependency for backend.

## Commands

```bash
yarn test                  # renderer (vitest) + node-client (node:test)
yarn test:node-client      # node-client only (106 tests)
yarn test:rebuild          # rebuilds better-sqlite3 for Node before tests, Electron after
```

## Architecture

```
src/node-client/           Drizzle + better-sqlite3 backend
  ├── factory.ts           createClient() → NodeClient
  ├── schema.ts            symlink → ../bun-client/schema.ts
  ├── migrations/          symlink → ../bun-client/migrations/
  ├── *.ts                 journals, documents, tags, etc.
  └── *.test.ts            node:test suite

src/preload/client/
  ├── factory.ts           delegates to node-client
  ├── index.ts             async singleton (initClient/getClient)
  └── types.ts             IClient interface (imports from node-client)
```

## Native module note

`better-sqlite3` must be compiled for the target runtime. `yarn test:rebuild` handles the Node↔Electron rebuild dance. Regular `yarn test` assumes the module matches system Node (true after `npm rebuild better-sqlite3`).

## Deferred

- **node:sqlite** — Works in Node 22+ and Electron 39 (verified). Drizzle has no driver yet ([#5471](https://github.com/drizzle-team/drizzle-orm/issues/5471)). Wait for Drizzle, or use `drizzle-orm/sqlite-proxy` to eliminate the native module rebuild dance.
- **MCP server on Node** — Currently Bun-only (`bun run src/bun-client/mcp/server.ts`). Straightforward port: swap factory import.
- **Remove old preload modules** — Delete `src/preload/client/{documents,journals,tags,...}.ts` and Knex dependency once stable.
