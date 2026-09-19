# Derived data and repair

SQLite is the note store. `documents` (content, title, journal, timestamps) and `document_tags` are canonical. `document_links`, `image_links`, and `documents_fts` are **derived** from `documents.content` — never written directly.

`derive(doc)` (`src/node-client/derive.ts`) parses the content to MDAST and regenerates a document's links, image links, and FTS row. Every write that touches content — `createDocument`, `updateDocument`, `importDocument`, and bulk operations (which go through `updateDocument`) — calls it inside the same transaction as the content write, so derived tables can never drift from `documents`.

`documents.rebuildDerived()` (Preferences → Repair) truncates and regenerates `document_links`, `image_links`, and `documents_fts` for every row in `documents`. Use it if derived data is ever suspected to be wrong; it never touches `documents` or `document_tags`.

`chronicles-tree.ts` is a filesystem reader only (`<root>/<journal>/<id>.md`), not an indexer — it's used by the Chronicles importer (`importer-chronicles.ts`) to read an exported/legacy notes tree into the database. The old filesystem indexer (mtime/hash fast paths, orphan cleanup, a `sync` table, startup indexing) is gone.

Two things worth knowing that aren't obvious from the code:

- **FTS is application-managed, not trigger-based.** `derive()` does an explicit delete+insert into `documents_fts` rather than relying on SQLite triggers, matching how the rest of the write path already works — see [sqlite-source-of-truth.md](designs/sqlite-source-of-truth.md).
- **Tags are not derived.** Unlike links/images, there's nothing in `documents.content` to rebuild tags from — they're user input with no canonical source elsewhere, so `document_tags` is written directly by callers and left alone by `rebuildDerived()`.

## Search

Full-text search uses SQLite's FTS5 extension (`documents_fts`, Porter stemmer, `unicode61` tokenizer). See [search.md](search.md) for query syntax.
