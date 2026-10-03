# Derived data

Derived data is a local cache computed from a note's `title` and `content`.
Every implementation must produce exactly the `expected` output of each case in
`vectors/derive/*.json`:

```json
{
  "name": "…",
  "title": "string or null",
  "markdown": "note content",
  "expected": {
    "noteLinks": [{ "targetId": "…", "targetJournal": "…" }],
    "imageLinks": ["destination", "…"],
    "fts": { "title": "…", "content": "…" }
  }
}
```

## Rules (current implementation)

Parse `content` as CommonMark + GFM. Only `link` and `image` nodes count:
code spans, code blocks, HTML, and reference-style links/images
(`[a][ref]`, `![a][ref]`) are not derived.

- **noteLinks** — for each inline `link` whose destination does not contain
  `://`, ends in `.md`, and matches `^\.\./(?:(.+)/)?([a-zA-Z0-9-]+)\.md$`
  with a journal segment: `{targetId: group 2, targetJournal: group 1}`.
  Destinations are taken after CommonMark unescaping but are not
  percent-decoded. Keep the first occurrence of each `targetId`, in document
  order.
- **imageLinks** — every inline `image` destination, deduplicated, in document
  order. Remote and `data:` URLs are included.
- **fts** — `title` (or `""` when null) and `content` verbatim.

Known gaps, deliberately locked until the data spec v1 migrations change them:
reference-style note links are not derived, and `chronicles://note/<id>` links
are not yet recognized.
