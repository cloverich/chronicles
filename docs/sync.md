# Sync System

## Overview

Sync builds a **SQLite cache** from markdown files on disk. **Markdown files are the source of truth**; the database enables fast search and organization.

Sync uses **incremental updates**: unchanged files are skipped based on mtime/size/hash checks. Only modified files are re-parsed and re-indexed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Filesystem (Source of Truth)                │
│              notesDir/journal_name/document_id.md           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SYNC PROCESS                         │
│                                                             │
│  1. Pre-fetch all sync metadata from DB (mtime/size/hash)   │
│  2. Walk filesystem for .md files                           │
│                                                             │
│  For each file:                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FAST PATH: mtime + size match → skip entirely          │ │
│  │ MEDIUM PATH: hash matches → update meta only           │ │
│  │ SLOW PATH: content changed → parse mdast, reindex      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  3. Delete orphaned documents (files removed from disk)     │
│  4. Clean up orphaned journals                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Database (Cache)                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
│  │documents │ │journals  │ │doc_tags   │ │document_links│  │
│  └──────────┘ └──────────┘ └───────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Performance

**Bottleneck**: mdast parsing (~2-6ms per document on M2 Mac)

The incremental sync strategy minimizes parsing:

- **Unchanged files**: ~0ms (stat check only)
- **Changed files**: ~2-6ms (full parse + index)

For 4000 documents with no changes, sync completes in ~2-4 seconds instead of ~30+ seconds.

## Database Tables

| Table            | Purpose                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `documents`      | Content, title, journal, frontmatter, sync metadata (mtime/size/contentHash) |
| `journals`       | Organizational containers (directories)                                      |
| `document_tags`  | Many-to-many: document ↔ tags                                               |
| `document_links` | Links between documents (for backlinks)                                      |
| `image_links`    | Image references with resolution status                                      |
| `sync`           | Sync run metadata (timestamps, counts, errors)                               |

Schema: `src/electron/migrations/20211005142122.sql`

## Key Files

| Component               | Path                                         |
| ----------------------- | -------------------------------------------- |
| **SyncClient**          | `src/preload/client/sync.ts`                 |
| **DocumentsClient**     | `src/preload/client/documents.ts`            |
| **SyncStore** (UI)      | `src/hooks/stores/sync.ts`                   |
| **Frontmatter parsing** | `src/preload/client/importer/frontmatter.ts` |
| **Directory walker**    | `src/preload/utils/fs-utils.ts`              |
| **Migrations**          | `src/electron/migrations/index.ts`           |

## When Sync Runs

| Scenario               | Behavior                                          |
| ---------------------- | ------------------------------------------------- |
| Normal startup         | Incremental sync in background (doesn't block UI) |
| > 1 month since sync   | Full re-index (skips mtime/hash checks)           |
| Change notes directory | Full re-index                                     |
| Manual "Sync" button   | Full re-index                                     |
| After import           | Full re-index                                     |

## Sync vs Import

|             | **Import**                             | **Sync**                         |
| ----------- | -------------------------------------- | -------------------------------- |
| **Input**   | External files (Notion, Obsidian)      | Existing markdown files          |
| **Output**  | Markdown files on disk                 | SQLite index                     |
| **Purpose** | Convert formats to Chronicles markdown | Build searchable cache           |
| **Parses**  | External formats, wikilinks, OFM tags  | YAML frontmatter, markdown links |

**Flow**: Import writes files → Sync indexes them

Import converts `[[wikilinks]]` to standard markdown links during file creation. Sync indexes standard markdown links into `document_links` for backlink features.

## Metadata Extracted

During indexing, sync extracts from each markdown file:

- **Frontmatter**: title, createdAt, updatedAt, tags
- **Content**: Full markdown body (stored for search)
- **Links**: Internal document links (`[title](../journal/id.md)`)
- **Images**: Image references (tracked for validation)
