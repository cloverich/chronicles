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
  node-client/     Drizzle + better-sqlite3 backend (documents, journals, search, import, migrations/)
  preload/         IPC bridge + client API definitions
  views/           React views (documents, edit, preferences)
  components/      Reusable UI (Radix-based)
  hooks/           React hooks, MobX stores (hooks/stores/)
  markdown/        Markdown parsing + serialization (indexer, search, import)
```

## Storage

SQLite is the source of truth for notes — `documents` (including a `content` column with the Markdown body) and `document_tags` are canonical; `document_links`, `image_links`, and `documents_fts` are derived from `content` on every write (see [docs/indexer.md](indexer.md)). Journals are DB-only rows, not directories; names are unique ignoring case (`Features` and `features` are the same journal — create/rename reject collisions, imports merge into the existing name, and `in:` search matches ignoring case). `notesDir` on disk holds only `_attachments/` and the settings/themes files (see `src/electron/settings.ts`). Markdown files reappear only at the file-format boundary: import, export, and backup (`src/node-client/importer*.ts`, `export.ts`, `backup.ts`).

Database: Drizzle + better-sqlite3. Migrations in `src/node-client/migrations/` (generate with `bunx drizzle-kit generate`, config at `drizzle.config.ts`), applied via `src/node-client/factory.ts`.

## Markdown Pipeline

See [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md) for the full pipeline.

Parsing (indexer, search, import): micromark with OFM extensions -> MDAST -> remark stringify. The editor no longer participates in this pipeline — it has its own Lexical-owned markdown roundtrip (see [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md)).

Custom syntax: `#tag`, `#tag/subtag`, `[[wikilink]]`, YAML frontmatter, GFM tables/task lists.

## Editor

See [docs/editor/](editor/) for plugin and styling details.

Lexical. Two modes: rich text (WYSIWYG) and markdown source. Custom plugins handle note linking, images, and markdown serialization.

## State Management

MobX stores in `src/hooks/stores/`. Document editing state via `useEditableDocument` hook. Separate stores for preferences and journals.
