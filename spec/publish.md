# Publishing

Status: draft, version 1. One target kind, `hugo-bundle`.

Publishing is a one-way **projection** of one note into a public form. It
reads the library and never syncs back. The note stays the source: editing it
changes nothing public until the next publish. Unpublishing removes the public
copy and never touches the note.

A projection is a pure function:

```
project(note, attachments, target, published) → bundle
```

- `note`: the note as stored (references in stored form).
- `attachments`: the blobs the note references.
- `target`: the target config (below).
- `published`: map of note ID → public URL for notes already published to this
  target. It decides how note links render.

Equal inputs give byte-identical bundles.

## Target config

```json
{
  "kind": "hugo-bundle",
  "frontMatter": ["description", "tags"],
  "author": "chris",
  "urlPrefix": "/blog/",
  "provenance": true
}
```

| Field         | Meaning                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `kind`        | `hugo-bundle`. Readers reject unknown kinds.                                              |
| `frontMatter` | Allowlist of keys copied to the bundle (see [Front matter](#front-matter)). Default `[]`. |
| `author`      | Written as `author` when present.                                                         |
| `urlPrefix`   | Public path the bundle directory is served under. Default `/blog/`.                       |
| `provenance`  | Write `chronicles: {id, revision}`. Default `true`.                                       |

Hosts store the config where they keep settings; it is not note data.

## Bundle layout

```
<date>/<slug>/index.md
<date>/<slug>/assets/<sha256><ext>
```

The bundle's path is `<date>/<slug>`. Its public URL is
`<urlPrefix><date>/<slug>/`.

- `<date>`: the UTC calendar date (`YYYY-MM-DD`) of the publish date.
- **Publish date:** user front-matter `date` when it parses as an ISO 8601
  timestamp, else the note's `createdAt`.
- **Slug:** user front-matter `slug` when it is a non-empty string of
  `[a-z0-9-]`, else the slugified title (below).

### Slugify

1. Unicode NFKD; drop combining marks (U+0300–U+036F).
2. Lowercase (ASCII).
3. Replace each run of characters outside `[a-z0-9]` with `-`.
4. Trim `-` from both ends.
5. If longer than 60 characters, cut at 60 and trim a trailing `-`.

A title that slugifies to empty is an error (`PUBLISH_NO_SLUG`); set `slug`.

## index.md

UTF-8, LF, the same line format as a note file
([export-format.md](export-format.md#frontmatter-lines)): `---`, one
`<key>: <compact JSON>` line per key, `---`, then, if the body is non-empty,
a blank line and the body.

### Front matter

Keys in this order, each written only when it has a value:

1. `title`: the note title. A note without a title (absent or empty) is an
   error (`PUBLISH_NO_TITLE`).
2. `date`: the publish date as written in front matter, else `createdAt`.
3. `author`: from the target.
4. `tags`: the note's tags in canonical order, only when `tags` is in the
   allowlist and the note has tags.
5. Each other allowlisted user front-matter key the note has, in code-point
   order of key. `title`, `date`, `author`, `draft`, `slug`, and `chronicles`
   are never copied from user keys.
6. `draft`: always `false`.
7. `chronicles`: `{"id":"<note id>","revision":"<note revision>"}` when
   `provenance` is on.

Every key not listed is dropped. Private keys stay private because nothing
reaches the bundle unless the allowlist names it.

**Reserved:** `headerImage` and `footerImage` are not projected in version 1,
even when allowlisted. A later version defines their shape (an attachment
reference plus alt text) and rewrites them like body images.

`slug` is not written: the bundle path carries it.

### Body

The note's `content`, with CRLF converted to LF and trailing newlines removed,
followed by exactly one LF. Only these spans change:

- **Attachments:** each `chronicles://attachment/<sha256><ext>` destination
  becomes `assets/<sha256><ext>`, and the blob is copied there. A referenced
  blob missing from the store is an error (`PUBLISH_MISSING_ATTACHMENT`): a
  post never ships a broken image.
- **Note links,** inline (`[text](chronicles://note/<id>)`): when `<id>` is in
  `published`, the destination becomes its URL. Otherwise the whole link is
  replaced by its text, the source bytes between `[` and `](`. Links inside
  code are text and are untouched.
- **Note link definitions** (`[label]: chronicles://note/<id>`): rewritten to
  the URL when published; otherwise an error (`PUBLISH_PRIVATE_LINK`), since
  dropping the definition would leave literal brackets.

Remote URLs, `data:` URLs, and everything else are untouched. Images are copied
as stored. Resizing for the site is the target's job (for pinecoder.dev, its
image script).

## Publishing a note

A host publishes into a **bundle root** (for pinecoder.dev, `content/blog/`):

1. **Pin the path.** If the note lacks user front-matter `slug` or `date`, write
   the missing ones first: the computed slug, and the current time as `date`.
   This is a normal note write (the revision changes once). Later edits to the
   title no longer move the post.
2. **Project** the note with the target config and the root's published map.
3. **Write** `<root>/<date>/<slug>/` atomically: build a temp sibling, then
   rename into place. If that directory already exists, replace it only if its
   `index.md` carries the same `chronicles.id`; otherwise refuse
   (`PUBLISH_PATH_TAKEN`). When replacing, keep any file in the old
   `assets/` whose name the new bundle also writes: the site may have resized
   it in place, and the same content-hash name means the same image.
4. **Move.** If another directory in the root carries the same
   `chronicles.id` (the slug or date was edited), remove it. The bundle root is
   expected to be under version control, so nothing is lost.

## Publication state

Until there is a publication record, the bundle root is the record: scan
`<root>/*/*/index.md` and read `chronicles.id` and `chronicles.revision`.
Requires `provenance`.

| State     | Condition                                                |
| --------- | -------------------------------------------------------- |
| Draft     | No bundle carries the note's ID.                         |
| Published | A bundle carries the ID and the note's current revision. |
| Edited    | A bundle carries the ID and a different revision.        |

_Edited_ compares revisions, so it also appears after edits the bundle would
not show (a private key, a tag not allowlisted). Version 1 accepts that.

The same scan gives the `published` map: ID → `<urlPrefix><date>/<slug>/`.

## Vectors

`vectors/publish/<case>/input.json` holds a library (as in export vectors),
plus:

```json
{
  "publish": {
    "note": "<note id>",
    "target": { ... },
    "published": { "<note id>": "/blog/2024-01-01/other/" }
  }
}
```

`expected/` holds the bundle exactly as written under a bundle root: one
`<date>/<slug>/` tree. A case whose input has `"expectedError": "<CODE>"` has
no `expected/`; projecting it fails with that code.

An implementation passes when projecting `publish.note` from the loaded library
yields `expected/` byte-for-byte, or fails with `expectedError`. Path pinning
(step 1) is a host write, not part of the projection, and is not vector-tested.
