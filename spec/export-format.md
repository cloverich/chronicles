# Export format

Format version **2.0**. The export is the archive format, the bootstrap path
between apps, and the definition of a note's canonical bytes (and therefore its
revision).

## Layout

```
<export>/
  manifest.json          canonical; byte-stable for unchanged data
  export-info.json       non-canonical: {"exportedAt": "<timestamp>"}
  <journal-dir>/<id>.md  one file per note
  _attachments/<aa>/<sha256><ext>
                         attachments referenced by exported notes (aa = sha256[0:2])
```

Two exports of unchanged data are byte-identical except `export-info.json`.
Writers publish atomically (write to a temp sibling, then rename) and refuse an
existing destination.

## Journal directories

Each journal maps to a unique directory name. Assign in code-point order of
journal name:

1. Replace each of `< > : " / \ | ? *`, U+0000–U+001F, and U+007F with `_`.
2. Strip trailing `.` and space characters.
3. If empty, use `journal`.
4. If it starts with `.`, `_`, `*`, or `~`, prefix `j`.
5. If it is a Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
   `LPT1`–`LPT9`, any case), append `_`.
6. If the result equals (ignoring ASCII case) `_attachments` or an
   already-assigned directory, append `-2`, `-3`, … until unique.

The manifest records the mapping; readers use it rather than recomputing.

## Note file

UTF-8 without BOM, LF line endings.

```
---
<frontmatter lines>
---
                                  ← blank line, only if the body is non-empty
<body>
```

### Frontmatter lines

One line per key, `<key>: <value>`. Every value is the compact JSON encoding
(as ECMAScript `JSON.stringify`, no whitespace) of the field — valid YAML flow
syntax, so ordinary YAML readers parse it.

Order:

1. `id`
2. `title` — omitted when absent; present (possibly `""`) otherwise
3. `journal` — journal ID (not the name, so a journal rename does not change
   the revision of every note in it)
4. `createdAt`
5. `updatedAt`
6. `tags` — deduplicated, sorted by code point; `[]` when empty
7. user keys, sorted by code point; keys with `undefined` values omitted

User keys are written bare when they match `^[A-Za-z][A-Za-z0-9_-]*$` and are
not (case-insensitively) `null`, `true`, `false`, `yes`, `no`, `on`, `off`,
`y`, `n`; otherwise as a JSON string. Object values have their keys sorted by
code point, recursively. Array order is preserved.

JSON string encoding: escape `"` and `\`; `\b \f \n \r \t` for those
characters; other U+0000–U+001F as `\u00xx` (lowercase hex); everything else,
including `/` and non-ASCII, literally. Numbers use the shortest round-trip
form (`3`, `0.5`, `1e+21`).

### Body

The note's `content` with CRLF converted to LF and trailing newlines removed,
followed by exactly one LF. An empty body writes nothing after the closing
fence. Leading blank lines are preserved.

### Links

Writers rewrite note links to `../<journal-dir>/<id>.md`, using the target
note's current journal (stale or legacy journal segments are corrected). The
directory segment is percent-encoded only for U+0000–U+0020, `%`, `(`, `)`,
`<`, `>`, `#`, `?`, `\`, U+007F; other characters are written literally. Links
to notes not in the export, links inside code, and remote URLs are untouched.
Only the destination bytes change; the rest of the body is preserved.

Writers rewrite `chronicles://attachment/<sha256><ext>` to
`../_attachments/<aa>/<sha256><ext>` when the blob exists; a missing blob's
reference is left in stored form and reported.

Readers map both back to stored forms (see
[data-model.md](data-model.md#reference-grammar)).

## Revision

`revision` = lowercase hex sha256 of the complete note file bytes.

## Manifest

`manifest.json` is `JSON.stringify(manifest, null, 2)` plus a trailing LF, with
keys in exactly this order:

```json
{
  "formatVersion": "2.0",
  "journals": [{ "id": "<uuid25>", "name": "work", "dir": "work" }],
  "notes": [
    {
      "id": "…",
      "journalId": "<uuid25>",
      "path": "work/<id>.md",
      "revision": "<sha256>"
    }
  ],
  "attachments": [
    {
      "path": "_attachments/<aa>/<sha256><ext>",
      "sha256": "<sha256>",
      "ext": ".png",
      "byteSize": 68
    }
  ]
}
```

- `journals`: every journal (including empty ones), in code-point order of
  name.
- `notes`: every note, in code-point order of `id`.
- `attachments`: every attachment referenced by an exported note and present
  in the store, in code-point order of `path`. Missing attachments are reported
  to the user, not listed.

## Versioning

`formatVersion` is `"<major>.<minor>"`. Readers reject an unknown major version
with a clear error. Minor versions only add optional fields.

Version 1 exports (`"version": 1` in the manifest, block-style YAML
frontmatter, directory name = journal name) and plain Chronicles notes
directories remain importable.

## Import

1. Read `manifest.json` if present; reject an unknown major version.
2. Create every manifest journal, then walk `<dir>/<id>.md` files; a note's
   journal is its directory's manifest journal. Journals match an existing
   journal by ID, then by name ignoring ASCII case. A same-name journal with
   no notes adopts the imported ID; one with notes keeps its own ID and the
   imported notes merge into it.
3. A frontmatter `id` must equal the file name.
4. Body bytes are kept verbatim except rewritten reference destinations.
5. Existing IDs are skipped or replaced per the caller's explicit choice.
