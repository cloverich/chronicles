# Sync System Architecture

## Overview

The Sync system builds a **SQLite cache database** from markdown documents stored on the filesystem. **Markdown files are the source of truth**, and the SQLite database serves as an indexed cache for fast searching, querying, and organizing documents by journals.

**Core Principle**: Sync performs a full rebuild of the database index by scanning markdown files, parsing them, and re-inserting records into SQLite.

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Markdown Files (Filesystem)              │
│                    Source of Truth                          │
│    notesDir/journal_name/document_id.md                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   walk() utility     │
            │  Recursive scanner   │
            │   (depth limit: 1)   │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   loadDoc()          │
            │  - Read .md file     │
            │  - Parse frontmatter │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  createIndex()       │
            │  - Insert document   │
            │  - Extract metadata  │
            └──────────┬───────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              SQLite Database (Cache)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │documents │  │journals  │  │doc_tags  │  │doc_links │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│               Fast indexing & search                         │
└──────────────────────────────────────────────────────────────┘
```

## Sync Process Steps

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. START SYNC                                                   │
│    - Check needsSync() (skip if < 1 hour since last)           │
│    - Insert sync record with startedAt timestamp               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLEAR DATABASE (Full Rebuild)                               │
│    DELETE FROM document_tags;                                   │
│    DELETE FROM documents;                                       │
│    DELETE FROM journals;                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SCAN FILESYSTEM                                              │
│    for await (const file of walk(rootDir, 1, shouldIndex)) {   │
│      - Find all .md files                                       │
│      - Extract journal name from parent directory              │
│      - Skip hidden files, node_modules, dist, _attachments     │
│    }                                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. INDEX EACH DOCUMENT                                          │
│    for each markdown file:                                      │
│      a) Create/update journal entry                             │
│      b) loadDoc() → read file & parse YAML frontmatter          │
│      c) createIndex() → insert into database                    │
│         - Insert document record                                │
│         - Insert tags into document_tags                        │
│         - Extract image references                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ENSURE DEFAULT JOURNAL                                       │
│    - Check if defaultJournal preference exists in database      │
│    - Create if missing                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. FINALIZE SYNC RECORD                                         │
│    UPDATE sync SET                                              │
│      completedAt = now(),                                       │
│      syncedCount = N,                                           │
│      errorCount = M,                                            │
│      durationMs = elapsed                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### File Locations

| Component                         | Path                                               | Description                       |
| --------------------------------- | -------------------------------------------------- | --------------------------------- |
| **SyncStore**                     | `src/hooks/stores/sync.ts`                         | UI-layer sync orchestration       |
| **useSyncStore**                  | `src/hooks/useSyncStore.ts`                        | React hook to access SyncStore    |
| **SyncClient**                    | `src/preload/client/sync.ts:68-194`                | API-layer sync orchestration      |
| **DocumentsClient.createIndex()** | `src/preload/client/documents.ts:316-349`          | Indexes document into database    |
| **walk()**                        | `src/preload/utils/fs-utils.ts:22-48`              | Recursive directory walker        |
| **loadDoc()**                     | `src/preload/client/documents.ts:119-128`          | Reads markdown + frontmatter      |
| **parseChroniclesFrontMatter()**  | `src/preload/client/importer/frontmatter.ts:51-64` | Parses YAML frontmatter           |
| **useApplicationLoader**          | `src/hooks/useApplicationLoader.ts:77-97`          | Triggers sync on startup          |
| **Preferences UI**                | `src/views/preferences/index.tsx`                  | Manual sync trigger via SyncStore |

### Database Schema

**Core Tables** (defined in `src/electron/migrations/20211005142122.sql`):

- **documents**: Markdown content, metadata, title, journal reference
- **document_tags**: Many-to-many relationship for tags
- **document_links**: Links between documents (parsed from markdown)
- **image_links**: Image references and validation status
- **journals**: Organizational containers
- **sync**: Metadata about sync runs (timestamps, counts, errors)

**Indexes**: Optimized for title search, date queries, tag lookups, and link traversal.

## UI Layer: SyncStore

Chronicles uses a **store pattern** to separate UI state management from the API layer. The `SyncStore` is a MobX observable store that centralizes all sync operations in the UI.

### SyncStore Architecture

Located in `src/hooks/stores/sync.ts`:

```typescript
export class SyncStore {
  isSyncing: boolean = false;
  lastSyncTime: Date | null = null;
  error: Error | null = null;

  sync = async (force: boolean = false): Promise<void> => {
    // Prevent duplicate calls
    if (this.isSyncing) return;

    this.isSyncing = true;

    // Show toast notification
    toast.info("Syncing cache...may take a few minutes");

    // Call underlying client sync
    await this.client.sync.sync(force);

    // Refresh journals to pick up changes
    await this.journalsStore.refresh();

    // Show success notification
    toast.success("Cache synced");

    this.isSyncing = false;
  };
}
```

**Key Features**:

- **Prevents duplicate syncs**: No-op if sync already in progress
- **Manages notifications**: Automatic toast messages for sync lifecycle
- **Refreshes journals**: Ensures UI reflects latest journals after sync
- **Observable state**: Components can react to `isSyncing` changes
- **Error handling**: Tracks and displays sync errors

**Usage in Components**:

```typescript
const syncStore = useSyncStore();

// Trigger sync
await syncStore.sync(true);

// Check if syncing (for button states, etc.)
<Button loading={syncStore.isSyncing} disabled={syncStore.isSyncing}>
  Sync folder
</Button>
```

## Sync Triggers

### 1. Application Startup (Automatic)

Located in `src/hooks/useApplicationLoader.ts:77-97`:

```typescript
async function load() {
  // Check if sync is needed (< 1 hour since last)
  if (await client.sync.needsSync()) {
    const toastId = toast("Syncing notes database", { duration: Infinity });
    await client.sync.sync(); // Direct client call during initialization
    toast.dismiss(toastId);
  }

  // Load journals into MobX store
  const journalStore = await JournalsStore.init(client);

  // Initialize SyncStore
  const syncStore = new SyncStore(client, journalStore);

  setJournalsStore(journalStore);
  setSyncStore(syncStore);
}
```

**Behavior**: On app startup, checks if > 1 hour has passed since last successful sync. If so, automatically syncs before loading the UI.

**Note**: Startup sync uses `client.sync` directly because the `SyncStore` hasn't been initialized yet. All subsequent syncs use the `SyncStore`.

### 2. Manual Trigger (Preferences UI)

Located in `src/views/preferences/index.tsx`:

```typescript
const syncStore = useSyncStore();

// Sync button click handler
<Button
  loading={syncStore.isSyncing}
  disabled={syncStore.isSyncing}
  onClick={() => syncStore.sync(true)}
>
  Sync folder
</Button>
```

**User Path**: Preferences → Storage → "Sync" button

**Note**: The `sync(true)` parameter forces sync regardless of time since last sync. The SyncStore handles all toast notifications and journal refresh automatically.

### 3. Post-Import

Located in `src/preload/client/importer.ts:158`:

```typescript
await this.syncs.sync(true);
```

**Behavior**: After importing notes from external sources (Notion, Obsidian), sync runs to index the newly imported markdown files into the database.

## Sync vs Import

```
┌──────────────────────────────────────────────────────────────┐
│                         IMPORT                               │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐    │
│  │  External  │  →   │   Stage    │  →   │  Process   │    │
│  │   Files    │      │   Notes    │      │   Staged   │    │
│  │ (Notion,   │      │  (Parse &  │      │  (Write to │    │
│  │  Obsidian) │      │  Convert)  │      │ filesystem)│    │
│  └────────────┘      └────────────┘      └────────────┘    │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                          SYNC                                │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐    │
│  │  Markdown  │  →   │    Parse   │  →   │   Insert   │    │
│  │   Files    │      │ Frontmatter│      │    into    │    │
│  │ (existing) │      │  & Links   │      │  Database  │    │
│  └────────────┘      └────────────┘      └────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Key Differences**:

- **Import**: Converts external formats → markdown files (does NOT index)
- **Sync**: Reads markdown files → builds SQLite index

Import is a two-phase process:

1. **Stage**: Parse external files, convert OFM (Obsidian Flavored Markdown) → Chronicles markdown
2. **Process**: Write markdown files to filesystem (calls `createDocument()` with `index=false`)
3. **Post-process**: Calls `sync.sync(true)` to index all imported documents

## Metadata Extraction

During `createIndex()`, the following metadata is extracted:

```
Markdown File
    │
    ├─→ YAML Frontmatter
    │   ├─→ title
    │   ├─→ createdAt
    │   ├─→ updatedAt
    │   └─→ tags[] → INSERT INTO document_tags
    │
    ├─→ Markdown AST Parsing
    │   ├─→ Note links [[note]] → INSERT INTO document_links
    │   └─→ Images ![](path) → INSERT INTO image_links
    │
    └─→ Content (body) → stored as text in documents table
```

### Link Resolution

**Note Links**:

- Extracted from markdown AST
- Must end with `.md` and not be external URLs
- Stored with `targetId` and `targetJournal` for bidirectional linking

**Image Links**:

- Resolved against filesystem
- Tracked for debugging and validation
- Stored with resolved path and exists status

## Performance & Error Handling

### Caching Strategy

`needsSync()` (in `src/preload/client/sync.ts:47-63`) prevents unnecessary syncs:

```typescript
needsSync = async () => {
  const lastSync = await this.knex("sync").orderBy("id", "desc").first();

  if (lastSync?.completedAt) {
    const diff = now.getTime() - lastSync.completedAt.getTime();
    const diffHours = Math.trunc(diff / (1000 * 60 * 60));

    if (diffHours < 1) {
      console.log("skipping sync; last sync was less than an hour ago");
      return false;
    }
  }

  return true;
};
```

**Threshold**: 1 hour between automatic syncs.

### Error Handling

- Invalid document IDs (checked with `checkId()`) are skipped
- Documents with parsing errors logged to `erroredDocumentPaths`
- Errors are non-blocking; sync continues with next document
- Final `errorCount` recorded in sync table for observability

### Performance Considerations

- **Depth Limit**: `walk()` uses `depth=1`, scanning only one directory level
  - Assumes structure: `notesDir/journal_name/document.md`
- **Transactions**: Database operations batched for consistency
- **Progressive**: Handles large document collections via streaming iteration
- **Skippable Files**: Excludes hidden files, `node_modules`, `dist`, `_attachments`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS (React)                    │
│  ┌──────────────────┐           ┌──────────────────┐              │
│  │  useAppLoader    │           │  Preferences UI  │              │
│  │  (Startup)       │           │  (Manual sync)   │              │
│  └────────┬─────────┘           └────────┬─────────┘              │
│           │                              │                         │
│           │ client.sync (startup only)   │ syncStore.sync()        │
│           │                              │                         │
│           │              ┌───────────────▼─────────────────┐       │
│           │              │         SyncStore               │       │
│           │              │  (UI State Management)          │       │
│           │              │  - isSyncing: observable        │       │
│           │              │  - sync(): orchestrates UI ops  │       │
│           │              │  - Manages toasts & refresh     │       │
│           │              └───────────────┬─────────────────┘       │
│           └──────────────────────────────┘                         │
│                          │                                          │
│                          │ window.chronicles.getClient()            │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           │ IPC (contextBridge)
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                    PRELOAD LAYER (Node.js)                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  SyncClient (API Layer)                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │needsSync │→ │  sync()  │→ │ walk()   │→ │loadDoc() │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  │         │              │              │            │       │   │
│  │         └──────────────┴──────────────┴────────────┘       │   │
│  │                          │                                  │   │
│  │                          ▼                                  │   │
│  │  ┌───────────────────────────────────────────────────┐    │   │
│  │  │  DocumentsClient.createIndex()                    │    │   │
│  │  │  - INSERT INTO documents                          │    │   │
│  │  │  - INSERT INTO document_tags                      │    │   │
│  │  │  - Parse AST for links & images                   │    │   │
│  │  └───────────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │ better-sqlite3
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                  MAIN PROCESS (Electron)                            │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  SQLite Database (chronicles.db)                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │  │documents │  │journals  │  │doc_tags  │  │  sync    │   │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Layered Architecture Pattern

Chronicles uses a **three-layer architecture** for sync operations:

### Layer 1: UI Layer (View Models / Stores)

**Purpose**: Manage UI state, orchestrate user interactions, provide reactive observables

**Components**: `SyncStore`, `JournalsStore`, `PreferencesStore`

**Responsibilities**:

- Observable state for React components
- Prevent duplicate operations
- Manage user notifications (toasts)
- Coordinate between stores (e.g., sync → refresh journals)
- Handle UI-specific logic (loading states, navigation)

**Pattern**: MobX observable stores accessed via React hooks

### Layer 2: API Layer (Client / Preload)

**Purpose**: Expose RPC-style methods to interact with the Electron main process

**Components**: `SyncClient`, `DocumentsClient`, `JournalsClient`, `ImporterClient`

**Responsibilities**:

- Define API interface for renderer process
- Handle IPC communication with main process
- Provide type-safe method calls
- No UI concerns (no toasts, no navigation)

**Pattern**: Client classes exposed via `window.chronicles.getClient()`

### Layer 3: Main Process (Electron Backend)

**Purpose**: File system access, database operations, native OS integration

**Components**: SQLite database, file system operations, native dialogs

**Responsibilities**:

- Actual file I/O and database queries
- Node.js and native module access
- Security boundary (sandboxed renderer cannot access directly)

**Pattern**: Main process handlers responding to IPC messages

### Why This Pattern?

1. **Separation of Concerns**: UI logic stays in stores, API logic in clients
2. **Reusability**: Stores can be used by multiple components
3. **Testability**: Each layer can be tested independently
4. **Type Safety**: TypeScript types flow through all layers
5. **Observability**: MobX makes UI automatically reactive to state changes

## Key Takeaways

1. **Source of Truth**: Markdown files on filesystem, SQLite is a cache
2. **Full Rebuild**: Each sync deletes and rebuilds the entire database
3. **Automatic**: Runs on startup if > 1 hour since last sync
4. **Manual**: Available via Preferences → Storage → Sync button (uses `SyncStore`)
5. **Post-Import**: Automatically triggered after importing external notes
6. **Error Resilient**: Individual document failures don't stop sync
7. **Performance**: 1-hour caching, depth-limited scan, transaction batching
8. **Metadata Rich**: Extracts tags, links, images, and frontmatter during indexing
9. **Centralized UI State**: `SyncStore` provides single source of truth for sync state in UI
10. **Layered Architecture**: UI stores → API clients → Main process for clean separation
