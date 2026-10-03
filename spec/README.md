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
| `vectors/`                           | Golden inputs and expected outputs                                |

## Status

Draft. The data model is migrating to data spec v1 (stable journal IDs, ID-only
note links, content-addressed attachments, revisions, tombstones). Each
document marks which rules are already implemented. Vectors always reflect the
current implementation exactly; when a migration changes behavior, its commit
regenerates the vectors and the diff shows the change.

## Vectors

```
vectors/
  export/<case>/input.json   library state (journals, notes, attachments)
  export/<case>/expected/    the exact export tree (minus export-info.json)
```

An implementation passes a vector when:

- **export:** loading `input.json` into an empty library and exporting yields
  `expected/` byte-for-byte; importing `expected/` into an empty library and
  exporting again also yields `expected/` byte-for-byte.

In this repo, `yarn test:node` runs every vector
(`src/node-client/spec-vectors.test.ts`). To regenerate after an intentional
change:

```bash
UPDATE_VECTORS=1 yarn test:node
```

then review the diff by hand. Vectors are excluded from prettier; never
reformat them.
