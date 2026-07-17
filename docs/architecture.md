# Architecture

Chronicles is a local-first, markdown-based journaling app built with Electron + React/TypeScript.

## Technology Stack

| Layer     | Technology                              |
| --------- | --------------------------------------- |
| Framework | Electron (main + renderer)              |
| Editor    | Lexical                                 |
| State     | MobX                                    |
| Bundler   | Vite (renderer), esbuild (main/preload) |
| Styling   | Tailwind CSS v4, Radix UI               |
| Database  | better-sqlite3 + Knex migrations        |
| Markdown  | micromark, MDAST, unified/remark        |

## Process Model

Electron runs three bundles:

1. **Main** (`src/electron/index.ts` -> `src/main.bundle.mjs`) — file system, database, native OS
2. **Preload** (`src/preload/index.ts` -> `src/preload.bundle.mjs`) — IPC bridge, `window.chronicles` API
3. **Renderer** (`src/index.tsx` -> Vite-managed `dist/index.html` + hashed assets in `dist/assets/`) — React application (sandboxed)

Communication flows through `src/preload/`; shared types live in `src/preload/client/types.ts`.

## Key Directories

```
src/
  electron/        Main process (app lifecycle, settings, IPC wiring)
  node-client/     Drizzle + better-sqlite3 backend (documents, journals, search, import)
  bun-client/      Drizzle SQL migrations (src/bun-client/migrations/)
  preload/         IPC bridge + client API definitions
  views/           React views (documents, edit, preferences)
  components/      Reusable UI (Radix-based)
  hooks/           React hooks, MobX stores (hooks/stores/)
  markdown/        Markdown parsing + serialization (indexer, search, import)
```

## Database

SQLite via Drizzle + better-sqlite3. Migrations in `src/bun-client/migrations/`, applied via `src/node-client/factory.ts`.

Core tables: `documents`, `journals`, `document_tags`, `files`.

## Markdown Pipeline

See [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md) for the full pipeline.

Parsing (indexer, search, import): micromark with OFM extensions -> MDAST -> remark stringify. The editor no longer participates in this pipeline — it has its own Lexical-owned markdown roundtrip (see [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md)).

Custom syntax: `#tag`, `#tag/subtag`, `[[wikilink]]`, YAML frontmatter, GFM tables/task lists.

## Editor

See [docs/editor/](editor/) for plugin and styling details.

Lexical. Two modes: rich text (WYSIWYG) and markdown source. Custom plugins handle note linking, images, and markdown serialization.

## State Management

MobX stores in `src/hooks/stores/`. Document editing state via `useEditableDocument` hook. Separate stores for preferences and journals.
