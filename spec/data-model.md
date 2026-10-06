# Data model

Status markers: **[now]** implemented. Everything in data spec v1 is now
implemented.

## Identifiers

- **Note ID** — uuidv7 encoded as uuid25 (25 chars, `[0-9a-z]`). Stable for the
  life of the note, across devices and exports. **[now]**
- **Journal ID** — uuid25, same scheme. Notes reference journals by ID; a
  rename changes only the journal. **[now]**
- **Attachment ID** — lowercase hex sha256 of the stored bytes (after any
  upload processing, e.g. image resize). Identical bytes are one attachment.
  **[now]**

No identity is ever derived from a name or a path.

## Entities

### Journal

| Field        | Type       | Notes                                                              |
| ------------ | ---------- | ------------------------------------------------------------------ |
| `name`       | string     | Unique ignoring ASCII case; 1–25 chars; not `_attachments`; no `/` |
| `createdAt`  | timestamp  |                                                                    |
| `updatedAt`  | timestamp  |                                                                    |
| `archivedAt` | timestamp? | Set when archived; null otherwise                                  |

### Note

| Field         | Type       | Notes                                                |
| ------------- | ---------- | ---------------------------------------------------- |
| `id`          | uuid25     |                                                      |
| `journal`     | journal ID | **[now]**                                            |
| `title`       | string?    | Absent ≠ empty string                                |
| `createdAt`   | timestamp  |                                                      |
| `updatedAt`   | timestamp  |                                                      |
| `tags`        | string[]   | A set: unique; canonical order is code-point order   |
| `frontMatter` | object     | User keys only; never a column-owned key (see below) |
| `content`     | string     | Markdown body without frontmatter                    |

Column-owned keys: `id`, `title`, `journal`, `createdAt`, `updatedAt`, `tags`.
They live in their own fields and are stripped from `frontMatter` on write.

Timestamps are ISO 8601 strings in UTC with millisecond precision
(`2024-01-02T03:04:05.678Z`) when Chronicles writes them. Imported values are
preserved verbatim.

### Attachment

| Field          | Type      | Notes                                    |
| -------------- | --------- | ---------------------------------------- |
| `sha256`       | hex       | Primary key; hash of the bytes as stored |
| `ext`          | string    | Lowercase, with dot (`.webp`)            |
| `mime`         | string    |                                          |
| `byteSize`     | integer   |                                          |
| `originalName` | string?   | Informational                            |
| `createdAt`    | timestamp |                                          |

Attachments are immutable. Nothing is garbage-collected automatically.

### Revision

`revision` = lowercase hex sha256 of the note serialized exactly as a note file
(see [export-format.md](export-format.md#note-file)) **with references in
stored form** (`chronicles://note/…`, `chronicles://attachment/…`). It depends
on the note alone: an exported file differs only where link destinations were
rewritten, and its manifest entry carries this revision, not the file's hash.

Every write recomputes it. An update may carry `baseRevision`; if it differs
from the stored revision the update fails with a conflict and nothing is
written. Revisions give equality, not order. **[now]**

### Tombstone

`{id, kind: "note" | "journal", deletedAt, lastRevision?}`. Deleting removes
all content, tags, derived rows, and search entries; the tombstone lets
another device learn of the delete. Deleting a journal tombstones it and every
note in it. Re-creating an ID (e.g. by import) removes its tombstone. Exports
do not carry tombstones yet; compaction is defined with sync. **[now]**

## Reference grammar

References appear as Markdown link and image destinations in `content`.

### Note links

| Form                       | Where                                  |
| -------------------------- | -------------------------------------- |
| `chronicles://note/<id>`   | stored content (the only form written) |
| `../<journal-dir>/<id>.md` | exported files; accepted on import     |

Writers store only `chronicles://note/<id>`. Readers also accept the path form
`../<anything>/<id>.md` (legacy content, exports, other tools) and convert it
on import. The custom scheme was chosen over a bare ID: it is unambiguous to
parse, and every host can intercept it (Electron protocol handler,
`WKURLSchemeHandler`).

A note link is a `link` node whose destination matches one of the forms above.
Resolution is by `<id>` only; the journal segment is never trusted. Links
inside code spans and code blocks are text, not links.

### Attachment references

| Form                                          | Where                                   |
| --------------------------------------------- | --------------------------------------- |
| `chronicles://attachment/<sha256><ext>`       | stored content (the only form written)  |
| `../_attachments/<sha256[0:2]>/<sha256><ext>` | exported files                          |
| `../_attachments/<name>`                      | legacy content and exports; import only |

`<ext>` is the lowercased file extension with its dot (`.webp`), or empty.
The live store and exports share one layout:
`_attachments/<sha256[0:2]>/<sha256><ext>`. On import, any local image
destination or link into `_attachments/` is resolved within the import tree,
stored by content hash, and rewritten to the stored form; a reference whose
file is missing is left as written. Remote (`http:`, `https:`) and `data:`
URLs are not attachments.

## Markdown dialect

CommonMark + GFM (tables, strikethrough, task lists, autolink literals), plus
YAML frontmatter only in files (never inside `content`). Backends must preserve
`content` byte-for-byte except where this spec rewrites references.

## Derived data

Note-link rows, attachment-reference rows, and the FTS index are local caches
rebuilt from notes. They are never synced and never exported.
