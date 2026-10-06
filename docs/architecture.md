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
| Database  | better-sqlite3 + Drizzle migrations     |
| Markdown  | micromark, MDAST, unified/remark        |

## Process Model

Electron runs three bundles:

1. **Main** (`src/electron/index.ts` -> `src/main.bundle.mjs`) — file system, database, native OS
2. **Preload** (`src/preload/index.ts` -> `src/preload.bundle.mjs`) — IPC bridge, `window.chronicles` API
3. **Renderer** (`src/index.tsx` -> Vite-managed `dist/index.html` + hashed assets in `dist/assets/`) — React application (sandboxed)

The renderer never reads the host directly. `src/startup.tsx` (called from `src/index.tsx`) is the composition root: it waits for `window.chronicles.ready()`, takes four services, and injects them as React context, failing startup with a reason if one is missing:

- **NotesClient** (`NotesContext`, `useNotes()`): notes, journals, tags, attachments, bulk updates. A runtime-free contract in `src/contract/` (spec: `spec/notes-client.md`); the preload backs it with `src/node-client/notes-adapter.ts`. Errors cross `contextBridge` as `[notes:<code>] message` and are rehydrated into `NotesError`s (`src/contract/transport.ts`).
- **Settings** (`SettingsContext`, `useSettings()`): per-device app settings typed by `IPreferences`. Never library data.
- **Maintenance** (`MaintenanceContext`, `useMaintenance()`): import, export, rebuild derived data, reset library, backups.
- **PlatformServices** (`PlatformContext`, `usePlatform()`): dialogs, appearance, themes, fonts, code themes.

Settings and Maintenance are host-specific, so their interfaces live in `src/hooks/`, not the contract; the preload builds them in `src/preload/client/factory.ts`, and their errors cross the bridge the same way (`exposeService`/`hydrateService`).

Tests inject the in-memory reference NotesClient (`src/contract/memory.ts`) and the fakes in `src/test/fakes.ts`; no renderer test reads `window`.

## Key Directories

```
src/
  backup/          Snapshot backups, retention, and restore (main process)
  contract/        Runtime-free NotesClient contract, reference adapter, canonical serializer
  electron/        Main process (app lifecycle, settings, IPC wiring)
  node-client/     Drizzle + better-sqlite3 backend (documents, journals, search, import, migrations/)
  preload/         IPC bridge; builds the host services (client/factory.ts)
  views/           React views (documents, edit, preferences)
  components/      Reusable UI (Radix-based)
  hooks/           React hooks, MobX stores (hooks/stores/)
  markdown/        Markdown parsing + serialization (indexer, search, import)
```

## Storage

SQLite is the source of truth for notes — `documents` (including a `content` column with the Markdown body) and `document_tags` are canonical; `document_links`, `image_links`, and `documents_fts` are derived from `content` on every write (see [docs/indexer.md](indexer.md)). Journals are DB-only rows keyed by a uuid25 `id` (`documents.journalId` references it, so a rename is one row update), not directories; names are unique ignoring case (`Features` and `features` are the same journal — create/rename reject collisions, imports merge into the existing name, and `in:` search matches ignoring case). `notesDir` on disk holds only `_attachments/` and the settings/themes files (see `src/electron/settings.ts`). Markdown files reappear only at the file-format boundary: import and export (`src/node-client/importer*.ts`, `export.ts`).

The data model (IDs, `chronicles://note/<id>` links, content-addressed `chronicles://attachment/<sha256><ext>` attachments under `_attachments/<aa>/`, revisions, tombstones), the export format, and derived data are specified language-neutrally in `spec/`, with golden vectors every implementation must pass.

Backups are verified SQLite snapshots plus a content-addressed attachment pool in a folder the user picks, run from the main process (`src/backup/`); see [docs/features/backups.md](features/backups.md).

Database: Drizzle + better-sqlite3. Migrations in `src/node-client/migrations/` (generate with `bunx drizzle-kit generate`, config at `drizzle.config.ts`), applied via `src/node-client/factory.ts` with foreign keys off and a `foreign_key_check` afterwards (table rebuilds would otherwise cascade-delete). Migrations that need app logic call SQL functions registered there; work that needs the filesystem (moving legacy attachments into the pool) runs at startup after migrations.

## Markdown Pipeline

See [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md) for the full pipeline.

Parsing (indexer, search, import): micromark with OFM extensions -> MDAST -> remark stringify. The editor no longer participates in this pipeline — it has its own Lexical-owned markdown roundtrip (see [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md)).

Custom syntax: `#tag`, `#tag/subtag`, `[[wikilink]]`, YAML frontmatter, GFM tables/task lists.

## Editor

See [docs/editor/](editor/) for plugin and styling details.

Lexical. Two modes: rich text (WYSIWYG) and markdown source. Custom plugins handle note linking, images, and markdown serialization.

## State Management

MobX stores in `src/hooks/stores/`. Document editing state via `useEditableDocument` hook. Separate stores for preferences and journals.
