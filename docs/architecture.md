# Architecture

Chronicles is a local-first, markdown-based journaling app built with Electron + React/TypeScript.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Electron (main + renderer) |
| Editor | Slate.js / Plate |
| State | MobX |
| Bundler | esbuild |
| Styling | Tailwind CSS v4, Radix UI |
| Database | better-sqlite3 + Knex migrations |
| Markdown | micromark, MDAST, unified/remark |

## Process Model

Electron runs three bundles:

1. **Main** (`src/electron/index.js` -> `src/main.bundle.js`) — file system, database, native OS
2. **Preload** (`src/preload/index.ts` -> `src/preload.bundle.mjs`) — IPC bridge, `window.chronicles` API
3. **Renderer** (`src/index.tsx` -> `src/renderer.bundle.mjs`) — React application (sandboxed)

Communication flows through `src/preload/`; shared types live in `src/preload/client/types.ts`.

## Key Directories

```
src/
  electron/        Main process, database migrations
  preload/         IPC bridge + client API definitions
  views/           React views (documents, edit, preferences)
  components/      Reusable UI (Radix-based)
  hooks/           React hooks, MobX stores (hooks/stores/)
  markdown/        Custom markdown parsing + serialization
```

## Database

SQLite via Knex. Migrations in `src/electron/migrations/`.

Core tables: `documents`, `journals`, `document_tags`, `files`.

## Markdown Pipeline

See [docs/editor/markdown-pipeline.md](editor/markdown-pipeline.md) for the full pipeline.

Parsing: micromark with OFM extensions -> MDAST -> Slate/Plate -> roundtrip back to markdown.

Custom syntax: `#tag`, `#tag/subtag`, `[[wikilink]]`, YAML frontmatter, GFM tables/task lists.

## Editor

See [docs/editor/](editor/) for plugin and styling details.

Slate.js foundation + Plate extensions. Three modes: rich text, markdown source, read-only. Custom plugins handle note linking, images, and markdown serialization.

## State Management

MobX stores in `src/hooks/stores/`. Document editing state via `useEditableDocument` hook. Separate stores for preferences and journals.
