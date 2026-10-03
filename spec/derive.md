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
    "noteLinks": [{ "targetId": "…" }],
    "imageLinks": ["destination", "…"],
    "fts": { "title": "…", "content": "…" }
  }
}
```

## Rules (current implementation)

Parse `content` as CommonMark + GFM. Only `link` and `image` nodes count:
code spans, code blocks, HTML, and reference-style links/images
(`[a][ref]`, `![a][ref]`) are not derived.

- **noteLinks** — for each inline `link` whose destination is a note link
  (`chronicles://note/<id>`, or the path form `../<journal>/<id>.md` with a
  non-empty journal segment, matching
  `^\.\./(?:(.+)/)?([a-zA-Z0-9-]+)\.md$`): `{targetId: <id>}`. Destinations
  are taken after CommonMark unescaping and are not percent-decoded. Keep the
  first occurrence of each `targetId`, in document order.
- **imageLinks** — every inline `image` destination, deduplicated, in document
  order. Remote and `data:` URLs are included.
- **fts** — `title` (or `""` when null) and `content` verbatim.

Known gap, deliberately locked: reference-style note links are not derived.
