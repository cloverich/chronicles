# NotesClient

The platform-neutral API between the Chronicles UI and its host. TypeScript
definition: `src/contract/notes.ts` (runtime-free). Behavior is pinned by the
fixtures in `vectors/contract/`, which are the source of truth: a host (the
Electron preload, a Swift WKWebView bridge, the in-memory reference) conforms
when every scenario passes.

All operations take one request object and resolve to a response object (or
nothing). Failures reject with `{code, message}`:

| Code            | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| `not_found`     | The note or journal named by the request doesn't exist                       |
| `conflict`      | Stale `baseRevision`, or a journal name already taken                        |
| `invalid_input` | A rule was violated (journal name, last journal, unknown journal for a note) |
| `unsupported`   | The host doesn't offer this capability                                       |
| `unavailable`   | The host failed (I/O, database)                                              |

## Operations

| Operation            | Request → Response                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `getNote`            | `{id}` → `Note`                                                                                                  |
| `searchNotes`        | `NoteQuery & {before?, limit?}` → `{items: NoteSummary[]}`                                                       |
| `countNotes`         | `NoteQuery` → `{count}`                                                                                          |
| `createNote`         | `{journalId, title?, content, tags?, frontMatter?, createdAt?}` → `{id, revision}`                               |
| `updateNote`         | `{id, baseRevision?, journalId, title?, content, tags, frontMatter?, createdAt?, updatedAt?}` → `{id, revision}` |
| `deleteNote`         | `{id}` → nothing; deleting a missing note is not an error                                                        |
| `listJournals`       | → `{journals: Journal[]}`                                                                                        |
| `createJournal`      | `{name}` → `Journal`                                                                                             |
| `renameJournal`      | `{id, name}` → `Journal`                                                                                         |
| `setJournalArchived` | `{id, archived}` → `Journal`                                                                                     |
| `deleteJournal`      | `{id}` → nothing; deletes the journal's notes                                                                    |
| `listTags`           | → `{tags: {tag, count}[]}`                                                                                       |
| `putAttachment`      | `{bytes, name}` → `{url, sha256, ext}`                                                                           |

`Note` is `{id, journalId, title, content, tags, createdAt, updatedAt,
frontMatter, revision}` per [data-model.md](data-model.md); `title` is `null`
when absent and `tags` are sorted by code point. `Journal` is `{id, name,
archived, noteCount}`. `NoteSummary` is `{id, journalId, title, createdAt}`.

## Rules

- **Revisions:** `revision` is defined in [data-model.md](data-model.md#revision).
  `updateNote` with a `baseRevision` that isn't current fails with `conflict`
  and writes nothing; without one it always applies. `createdAt` defaults to
  now (and is the initial `updatedAt`); an update's `updatedAt` defaults to now.
- **Search:** results are newest first (`createdAt` descending, then `id`
  descending). `journalIds`/`tags` match any listed value; `excludeJournalIds`
  /`excludeTags` remove notes having any; each `titles` entry must be a
  case-insensitive (ASCII) substring of the title; `date` is a prefix of
  `createdAt`; `before` is a date (`YYYY[-MM[-DD]]`, compared to `createdAt`)
  or otherwise a note id (compared to `id`). `texts` is host full-text search:
  each term must match the title or content; hosts may stem, so fixtures use
  plain words.
- **Journals:** names are trimmed, 1–25 characters, not `_attachments`, without
  `/` or lone surrogates (`invalid_input`), and unique ignoring ASCII case
  (`conflict`; re-casing a journal's own name is allowed). The last journal
  can be neither deleted nor archived (`invalid_input`). Lists are in
  code-point order of name.
- **Bulk updates:** `op` is `{type: "add_tag" | "remove_tag", tag}` or
  `{type: "change_journal", journalId}`. Every note matching `query` is
  changed; `updatedAt` and `revision` checks are not applied (revisions are
  recomputed). No matches is not an error. An empty tag or unknown journal is
  `invalid_input`.
- **Notes need a journal:** creating or moving a note into an unknown journal
  is `invalid_input`.
- **Attachments:** stored verbatim and addressed by content
  (`chronicles://attachment/<sha256><ext>`, `ext` = the name's lowercased
  extension or empty). Identical bytes return the same reference.

## Fixtures

`vectors/contract/<area>.json`:

```json
{
  "description": "…",
  "scenarios": [
    {
      "name": "…",
      "library": "basic",
      "steps": [
        { "op": "getNote", "request": { "id": "…" }, "response": { … } },
        { "op": "updateNote", "request": { … }, "error": { "code": "conflict" } }
      ]
    }
  ]
}
```

Each scenario starts from a fresh host seeded with `vectors/contract/libraries/<library>.json`
(journals with ids and `archivedAt`, notes as stored). Steps run in order.
Responses match exactly (object key order is irrelevant), with placeholders:
`"$any"` matches anything, `"$capture:x"` matches anything and binds `x`, and
`"$ref:x"` (in requests or responses) is the bound value. `{"$base64": "…"}`
in a request is binary. In this repo, `src/node-client/contract.test.ts` runs
every scenario against the in-memory and Node adapters.
