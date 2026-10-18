# Chronicles spec

Language-neutral definition of Chronicles data. Any implementation (Electron/Node
today, Swift next) reads, writes, and verifies against these documents and the
vectors beside them. Data compatibility is the boundary between apps; API shape
is per-app.

Another repository may vendor this directory as-is. Nothing here depends on the
Node code.

| Document                             | Defines                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| [data-model.md](data-model.md)       | Entities, identifiers, schema invariants, link/attachment grammar |
| [export-format.md](export-format.md) | Export tree, single-file form, partial export, manifest, versions |
| [derive.md](derive.md)               | Derived data (note links, image refs, FTS)                        |
| [notes-client.md](notes-client.md)   | The NotesClient API contract and its fixtures                     |
| [publish.md](publish.md)             | Projecting a note into a public bundle (a blog post)              |
| `vectors/`                           | Golden inputs and expected outputs                                |

## Status

Draft, implementing data spec v1 (stable journal IDs, ID-only note links,
content-addressed attachments, revisions, tombstones) and export format 2.0.
Vectors always reflect the current implementation exactly; a change in
behavior regenerates them, and the diff shows the change.

## Vectors

```
vectors/
  export/<case>/input.json   library state (journals, notes, attachments), plus
                             optional exportJournals (IDs) for a partial export
  export/<case>/expected/    the exact export tree (minus export-info.json)
  archive/<case>/*.zip       single-file exports of export/<case>/expected
  derive/<file>.json         markdown in → derived data out
  contract/<area>.json       NotesClient scenarios (seeded from contract/libraries/)
  publish/<case>/input.json  library state plus the note, target, and published map
  publish/<case>/expected/   the bundle tree (absent for an expectedError case)
```

An implementation passes a vector when:

- **export:** loading `input.json` into an empty library and exporting (only
  the `exportJournals` journals, when present) yields `expected/`
  byte-for-byte; importing `expected/` into an empty library and exporting
  the same journals again also yields `expected/` byte-for-byte. A writer of
  the single-file form passes when its archive extracts to `expected/` (plus
  `export-info.json`); archive bytes are not compared.
- **archive:** each `archive/<case>/*.chronicles.zip` extracts to
  `export/<case>/expected/` plus an `export-info.json`, and importing it
  equals importing the folder. `writer.chronicles.zip` is what the desktop
  writer produces (deflate and stored entries, data descriptors, UTF-8
  names); `zip64.chronicles.zip` holds the same tree in Zip64 records, which a
  reader must handle though small libraries never need them.
- **derive:** for each case, deriving from `title` + `markdown` yields
  `expected`.
- **contract:** every scenario passes against the host's NotesClient.
- **publish:** projecting the case's note yields `expected/` byte-for-byte, or
  fails with `expectedError` (see [publish.md](publish.md#vectors)).

In this repo, `yarn test:node` runs every vector
(`src/node-client/spec-vectors.test.ts`). To regenerate after an intentional
change:

```bash
UPDATE_VECTORS=1 yarn test:node
```

then review the diff by hand. Vectors are excluded from prettier; never
reformat them.
