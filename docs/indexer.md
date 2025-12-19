# Indexer System

## Overview

The indexer builds a **SQLite cache** from markdown files on disk. **Markdown files are the source of truth**; the database enables fast search and organization.

The indexer uses **incremental updates**: unchanged files are skipped based on mtime/size/hash checks. Only modified files are re-parsed and re-indexed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Filesystem (Source of Truth)                │
│              notesDir/journal_name/document_id.md           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       INDEX PROCESS                         │
│                                                             │
│  1. Pre-fetch all index metadata from DB (mtime/size/hash)  │
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
└─────────────────────────────────────────────────────────────┘
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

The incremental index strategy minimizes parsing:

- **Unchanged files**: ~0ms (stat check only)
- **Changed files**: ~2-6ms (full parse + index)

For 4000 documents with no changes, indexing completes in ~2-4 seconds instead of ~30+ seconds.

## Database Tables

| Table            | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `documents`      | Content, title, journal, frontmatter, index metadata (mtime/size/contentHash) |
| `journals`       | Organizational containers (directories)                                       |
| `document_tags`  | Many-to-many: document ↔ tags                                                |
| `document_links` | Links between documents (for backlinks)                                       |
| `image_links`    | Image references with resolution status                                       |
| `sync`           | Index run metadata (timestamps, counts, errors)                               |

Schema: `src/electron/migrations/20211005142122.sql`

## Key Files

| Component               | Path                                         |
| ----------------------- | -------------------------------------------- |
| **IndexerClient**       | `src/preload/client/indexer.ts`              |
| **DocumentsClient**     | `src/preload/client/documents.ts`            |
| **IndexerStore** (UI)   | `src/hooks/stores/indexer.ts`                |
| **Frontmatter parsing** | `src/preload/client/importer/frontmatter.ts` |
| **Directory walker**    | `src/preload/utils/fs-utils.ts`              |
| **Migrations**          | `src/electron/migrations/index.ts`           |

## When Indexing Runs

| Scenario               | Behavior                                           |
| ---------------------- | -------------------------------------------------- |
| Normal startup         | Incremental index in background (doesn't block UI) |
| > 1 month since index  | Full re-index (skips mtime/hash checks)            |
| Change notes directory | Full re-index                                      |
| Manual "Rebuild Index" | Full re-index                                      |
| After import           | Full re-index                                      |

## Indexer vs Import

|             | **Import**                             | **Indexer**                      |
| ----------- | -------------------------------------- | -------------------------------- |
| **Input**   | External files (Notion, Obsidian)      | Existing markdown files          |
| **Output**  | Markdown files on disk                 | SQLite index                     |
| **Purpose** | Convert formats to Chronicles markdown | Build searchable cache           |
| **Parses**  | External formats, wikilinks, OFM tags  | YAML frontmatter, markdown links |

**Flow**: Import writes files → Indexer indexes them

Import converts `[[wikilinks]]` to standard markdown links during file creation. The indexer indexes standard markdown links into `document_links` for backlink features.

## Metadata Extracted

During indexing, the indexer extracts from each markdown file:

- **Frontmatter**: title, createdAt, updatedAt, tags
- **Content**: Full markdown body (stored for search)
- **Links**: Internal document links (`[title](../journal/id.md)`)
- **Images**: Image references (tracked for validation)
