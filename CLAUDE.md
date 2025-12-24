# CLAUDE.md

Chronicles is a local-first, markdown based Journaling application written in Typescript/React and using Electron.

## Development process

- Generate plan / evaluate provided Github issue (`gh` command)
- Write code
- Run app (with HEADLESS=true to see renderer logs in main process)
- Validate further (yarn lint, yarn test, etc)
- Commit

## Development Commands

To install:

```bash
# Install dependencies (if needed)
yarn

# Manually rebuild native dependencies if needed
yarn run electron-rebuild --force

# nuclear - rarely needed
rm -rf node_modules
```

To run and validate:

```bash
# Headless to avoid UI, browser logs will show up in main process
# prefixed with [RENDERER]
HEADLESS=true yarn start

# Check eslint or typescript
yarn lint

# Fix prettier formatting (yarn lint only :checks)
yarn run lint:prettier:write

# Run the sparse tests - we need to add more!
yarn test

# See package.json for additional scripts
```

## Architecture Overview

**Technology Stack**

- **Framework**: Electron with React/TypeScript
- **Editor**: Slate.js with Plate extensions for rich text editing
- **State Management**: MobX for reactive state
- **Bundling**: esbuild for fast compilation
- **Styling**: Tailwind CSS with Radix UI components
- **Database**: better-sqlite3 with Knex migrations
- **Markdown**: Custom markdown processing with unified/remark

**Key Directories**

- `src/electron/` - Main Electron process code and database migrations
- `src/preload/` - Preload scripts for IPC communication between main and renderer
- `src/views/` - Main React application views (documents, edit, preferences)
- `src/components/` - Reusable UI components built on Radix
- `src/hooks/` - React hooks including MobX stores
- `src/markdown/` - Custom markdown processing system

**Build Process**
The build uses esbuild to create three bundles:

1. **Main Process** (`src/electron/index.js` → `src/main.bundle.js`)
2. **Preload Script** (`src/preload/index.ts` → `src/preload.bundle.mjs`)
3. **Renderer Process** (`src/index.tsx` → `src/renderer.bundle.mjs`)

Development mode (`yarn start`) watches all three bundles and restarts Electron on changes.

Production mode uses `electron-packager` and command `yarn build`

## Custom Markdown System

Chronicles storage format uses standard markdown with a few extensions, displayed to users through Slate

### Supported Syntax

- **Tags**: `#tag`, `#tag/subtag` - Hashtag-style tagging
- **Wikilinks**: `[[note]]`, `[[note#section|alias]]` - Wiki-style note linking
- **Standard GFM**: Tables, task lists, code blocks, etc.
- **Obsidian Flavored Markdown (OFM)** when importing / processing
- **YAML Frontmatter**: Metadata including title, tags, timestamps

**Processing Pipeline**

1. **Parsing**: micromark with custom OFM extensions
2. **AST**: MDAST (Markdown AST) with custom node types
3. **Editor**: Slate.js / Plate with custom elements for rich editing
4. **Storage**: Roundtrip markdown conversion preserving formatting

**Special Features**

- **Note Linking**: Automatic bidirectional linking between documents
- **Image Galleries**: Consecutive images grouped into galleries
- **Import Support**: Handles Notion and Obsidian exports
- **Local Files**: Custom `chronicles://` protocol for local file access

## Database Schema

Uses SQLite with Knex migrations in `src/electron/migrations/`:

- **documents**: Core document storage with markdown content
- **journals**: Organizational containers for documents
- **document_tags**: Many-to-many relationship for tagging
- **files**: Metadata for attachments and media

## IPC Communication

Communication between main and renderer processes via `src/preload/`:

- **Client APIs**: Exposed via `window.chronicles` in renderer
- **Type Safety**: Shared TypeScript types in `src/preload/client/types.ts`
- **Error Handling**: Structured error responses from main process

## Development Notes

**Electron Specifics**

- Main process handles file system, database, and native OS integration
- Renderer process is the React application (sandboxed)
- Preload script bridges the two with contextIsolation enabled for security (node / filesystem apis)

**Editor Implementation**

- Slate.js provides the rich text editing foundation
- Plate adds higher-level editing features and plugins
- Custom plugins handle note linking, images, and markdown serialization
- Editor modes: Rich text, markdown source, and read-only

**State Management**

- MobX stores in `src/hooks/stores/` for reactive state
- Document state managed through `useEditableDocument` hook
- Preferences and journals have dedicated stores

**Testing**

- Unit tests use Mocha with esbuild compilation - goal to use node's test runner or vitest long term
- Tests files: `*.test.ts` compiled to `*.test.bundle.js`
- Test database setup in `src/preload/client/importer/test/`

**CSS Architecture**

- Tailwind for utility-first styling
- Radix UI for accessible component primitives
- Dark mode support via CSS variables and theme switching
