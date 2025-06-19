# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start Development**

```bash
# Install dependencies (if needed)
yarn

# Start development server with hot reload
yarn start

# Manually rebuild native dependencies if needed
yarn run electron-rebuild --force
```

**Build and Package**

```bash
# Full production build (creates packaged app)
yarn build

# Just run the build script (without packaging)
./build.sh
```

**Testing and Quality**

```bash
# Run all tests
yarn test

# Run linting (prettier + typescript)
yarn lint

# Check types without emitting output
yarn run lint:types:check

# Fix prettier formatting
yarn run lint:prettier:write
```

**Individual Commands**

```bash
# Compile CSS
tailwindcss -i ./src/index.css -o ./src/index-compiled.css

# Type check
tsc --noEmit --skipLibCheck

# Run single test file
mocha 'src/**/*.test.bundle.js'
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
2. **Preload Script** (`src/preload/index.ts` → `src/preload.bundle.js`)
3. **Renderer Process** (`src/index.tsx` → `src/renderer.bundle.js`)

Development mode (`yarn start`) watches all three bundles and restarts Electron on changes.

## Custom Markdown System

Chronicles implements **Obsidian Flavored Markdown (OFM)** with custom extensions:

**Supported Syntax**

- **Tags**: `#tag`, `#tag/subtag` - Hashtag-style tagging
- **Wikilinks**: `[[note]]`, `[[note#section|alias]]` - Wiki-style note linking
- **Standard GFM**: Tables, task lists, code blocks, etc.
- **YAML Frontmatter**: Metadata including title, tags, timestamps

**Processing Pipeline**

1. **Parsing**: micromark with custom OFM extensions
2. **AST**: MDAST (Markdown AST) with custom node types
3. **Editor**: Slate.js with custom elements for rich editing
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
- Preload script bridges the two with contextIsolation enabled

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

- Unit tests use Mocha with esbuild compilation
- Tests files: `*.test.ts` compiled to `*.test.bundle.js`
- Test database setup in `src/preload/client/importer/test/`

**CSS Architecture**

- Tailwind for utility-first styling
- Radix UI for accessible component primitives
- Custom CSS for editor-specific styles and Prism code highlighting
- Dark mode support via CSS variables and theme switching
