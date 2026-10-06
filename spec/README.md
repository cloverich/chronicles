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
| [export-format.md](export-format.md) | Export tree, canonical note bytes, manifest, versioning           |
| [derive.md](derive.md)               | Derived data (note links, image refs, FTS)                        |
| [notes-client.md](notes-client.md)   | The NotesClient API contract and its fixtures                     |
| `vectors/`                           | Golden inputs and expected outputs                                |

## Status

Draft, implementing data spec v1 (stable journal IDs, ID-only note links,
content-addressed attachments, revisions, tombstones) and export format 2.0.
Vectors always reflect the current implementation exactly; a change in
behavior regenerates them, and the diff shows the change.

## Vectors

```
vectors/
  export/<case>/input.json   library state (journals, notes, attachments)
  export/<case>/expected/    the exact export tree (minus export-info.json)
  derive/<file>.json         markdown in → derived data out
  contract/<area>.json       NotesClient scenarios (seeded from contract/libraries/)
```

An implementation passes a vector when:

- **export:** loading `input.json` into an empty library and exporting yields
  `expected/` byte-for-byte; importing `expected/` into an empty library and
  exporting again also yields `expected/` byte-for-byte.
- **derive:** for each case, deriving from `title` + `markdown` yields
  `expected`.
- **contract:** every scenario passes against the host's NotesClient.

In this repo, `yarn test:node` runs every vector
(`src/node-client/spec-vectors.test.ts`). To regenerate after an intentional
change:

```bash
UPDATE_VECTORS=1 yarn test:node
```

then review the diff by hand. Vectors are excluded from prettier; never
reformat them.
