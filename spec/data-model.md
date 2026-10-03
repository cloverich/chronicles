# Data model

Status markers: **[now]** implemented; **[v1]** target of data spec v1, not yet
implemented.

## Identifiers

- **Note ID** — uuidv7 encoded as uuid25 (25 chars, `[0-9a-z]`). Stable for the
  life of the note, across devices and exports. **[now]**
- **Journal ID** — uuid25, same scheme. Notes reference journals by ID; a
  rename changes only the journal. **[now]**
- **Attachment ID** — lowercase hex sha256 of the stored bytes. **[v1]** Today
  attachments have random `createId()` file names. **[now]**

No identity is ever derived from a name or a path.

## Entities

### Journal

| Field       | Type      | Notes                                                              |
| ----------- | --------- | ------------------------------------------------------------------ |
| `name`      | string    | Unique ignoring ASCII case; 1–25 chars; not `_attachments`; no `/` |
| `createdAt` | timestamp |                                                                    |
| `updatedAt` | timestamp |                                                                    |
| `archived`  | boolean   | Stored in preferences today                                        |

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

### Attachment **[v1]**

| Field          | Type      | Notes                                    |
| -------------- | --------- | ---------------------------------------- |
| `sha256`       | hex       | Primary key; hash of the bytes as stored |
| `ext`          | string    | Lowercase, with dot (`.webp`)            |
| `mime`         | string    |                                          |
| `byteSize`     | integer   |                                          |
| `originalName` | string?   | Informational                            |
| `createdAt`    | timestamp |                                          |

Attachments are immutable. Nothing is garbage-collected automatically.

### Revision **[v1]**

`revision` = sha256 (lowercase hex) of the note's canonical bytes as defined in
[export-format.md](export-format.md#note-file). Updates carry `baseRevision`;
a mismatch is a `conflict`, never an overwrite. Revisions give equality, not
order.

### Tombstone **[v1]**

`{id, kind: "note" | "journal", deletedAt, lastRevision?}`. Deleting removes
all content; the tombstone lets another device learn of the delete.

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

| Form                                          | Where                             | Status    |
| --------------------------------------------- | --------------------------------- | --------- |
| `../_attachments/<name>`                      | stored content                    | **[now]** |
| `chronicles://attachment/<sha256><ext>`       | stored content                    | **[v1]**  |
| `../_attachments/<sha256[0:2]>/<sha256><ext>` | exported files, live store layout | **[v1]**  |

The editor renders a stored local reference by prefixing `chronicles://`; it
never stores that prefix for the `../_attachments/` form. Remote (`http:`,
`https:`) and `data:` URLs are not attachments.

## Markdown dialect

CommonMark + GFM (tables, strikethrough, task lists, autolink literals), plus
YAML frontmatter only in files (never inside `content`). Backends must preserve
`content` byte-for-byte except where this spec rewrites references.

## Derived data

Note-link rows, attachment-reference rows, and the FTS index are local caches
rebuilt from notes. They are never synced and never exported.
