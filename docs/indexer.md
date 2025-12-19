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
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐   │
│  │documents │ │journals  │ │doc_tags   │ │document_links│   │
│  └──────────┘ └──────────┘ └───────────┘ └─────────────┘   │
│  ┌──────────────┐                                           │
│  │documents_fts │  ← FTS5 full-text search index            │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Full-Text Search (FTS5)

Chronicles uses SQLite's **FTS5** extension for fast, feature-rich text search.

### Features

- **Fast lookups**: O(log n) via inverted index, not O(n) table scan
- **Stemming**: "running" matches "run" via Porter stemmer
- **Unicode support**: Proper handling of international characters
- **Phrase search**: `"exact phrase"` matching
- **Prefix search**: `java*` matches javascript, java, etc.

### How It Works

1. **Separate FTS table**: `documents_fts` is a virtual table parallel to `documents`
2. **Content indexed**: Title and markdown body are tokenized and indexed
3. **Search queries**: Use `MATCH` operator for fast lookups:
   ```sql
   SELECT id FROM documents_fts WHERE documents_fts MATCH 'search terms'
   ```

### Search Syntax

| Query              | Matches                               |
| ------------------ | ------------------------------------- |
| `javascript`       | Documents containing "javascript"     |
| `javascript react` | Documents containing both terms (AND) |
| `"react hooks"`    | Exact phrase                          |
| `java*`            | Prefix match (java, javascript, etc.) |

## Performance

**Bottleneck**: mdast parsing (~2-6ms per document on M2 Mac)

The incremental index strategy minimizes parsing:

- **Unchanged files**: ~0ms (stat check only)
- **Changed files**: ~2-6ms (full parse + index)

For 4000 documents with no changes, indexing completes in ~2-4 seconds instead of ~30+ seconds.

**Text search**: Near-instant via FTS5 inverted index (vs. slow LIKE scans).

## Database Tables

| Table            | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `documents`      | Metadata: title, journal, frontmatter, sync info          |
| `documents_fts`  | FTS5 virtual table for full-text search (title + content) |
| `journals`       | Organizational containers (directories)                   |
| `document_tags`  | Many-to-many: document ↔ tags                            |
| `document_links` | Links between documents (for backlinks)                   |
| `image_links`    | Image references with resolution status                   |
| `sync`           | Index run metadata (timestamps, counts, errors)           |

Schema: `src/electron/migrations/20211005142122.sql`

**Note**: Document content is stored only in the FTS table, not duplicated in `documents`. The markdown file on disk is the source of truth; content is read from disk when editing.

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
| **Output**  | Markdown files on disk                 | SQLite index + FTS               |
| **Purpose** | Convert formats to Chronicles markdown | Build searchable cache           |
| **Parses**  | External formats, wikilinks, OFM tags  | YAML frontmatter, markdown links |

**Flow**: Import writes files → Indexer indexes them

Import converts `[[wikilinks]]` to standard markdown links during file creation. The indexer indexes standard markdown links into `document_links` for backlink features.

## Metadata Extracted

During indexing, the indexer extracts from each markdown file:

- **Frontmatter**: title, createdAt, updatedAt, tags
- **Content**: Full markdown body (indexed in FTS5 for search)
- **Links**: Internal document links (`[title](../journal/id.md)`)
- **Images**: Image references (tracked for validation)
