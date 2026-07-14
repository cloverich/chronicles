# Design Doc: Chronicles Cloud (Cloudflare Workers)

> **Status: Speccing.** Direction agreed; decisions below marked _decided_ or
> _open_. Nothing here is implemented yet. Expect this doc to change.

## Motivation

Chronicles today is a desktop-only Electron app. That leaves real gaps:

- **Phone access** — no way to read or capture notes from iOS.
- **Work laptop** — no install; browser access would suffice.
- **Sharing** — no way to share a note (or journal) with e.g. a spouse.
- **Blog publishing** — Chronicles should be able to publish notes to (or be)
  the blog, in an integrated way.
- **LLM access (MCP)** — the stdio MCP server was deferred on native-module
  ABI problems ([chronicles-mcp.md](chronicles-mcp.md)); an HTTP backend is
  the cleanest unblock.

Target audience is deliberately small: the author, family, a few friends
self-hosting their own instance. This is **not** a multi-tenant SaaS design.

### Non-goals

- Mainstream scale, billing, team features.
- Native iOS app (a PWA on this backend likely makes it unnecessary; revisit
  after living with the web app). Note: Electron does not run on iOS at all.
- Real-time collaborative editing.

## Why Cloudflare Workers fits

The codebase is unusually well-positioned:

1. **The seam exists.** The renderer is a sandboxed React app that reaches the
   backend only through `window.chronicles.getClient()` → `IClient`
   (`src/hooks/useClient.ts`, `src/preload/client/types.ts`). An `HttpClient`
   implementing `IClient` over fetch lets the entire UI run in a browser
   unchanged.
2. **`node-client` is the portable backend.** Drizzle + SQLite with per-domain
   clients (documents, journals, tags, search). Drizzle ships a
   `durable-sqlite` driver with migrations; schema and queries port nearly
   verbatim into a Durable Object.
3. **FTS5 works.** Durable Object SQLite supports the FTS5 virtual table
   module (one of the only extensions allowed). The existing search port is
   direct. ([DO SQLite storage API][do-sqlite])
4. **Assets map 1:1.** The `chronicles://` protocol handler
   (`src/electron/index.ts`) becomes a Worker route serving R2 objects.

### Verified platform facts (July 2026)

- DO SQLite supports **FTS5** (and fts5vocab); other virtual-table modules
  (e.g. sqlite-vec) are rejected. ([docs][do-sqlite])
- **10 GB** SQLite storage per Durable Object. ([GA announcement][do-ga])
- DO SQLite storage **billing live since Jan 2026**; Workers Paid includes
  5 GB before overage — orders of magnitude above a lifetime of markdown.
  ([billing changelog][do-billing], [pricing][workers-pricing])
- **Cloudflare Access free tier: 50 users**, permanent (not a trial); email
  OTP or Google/GitHub IdP; fronts any self-hosted app. ([Access][cf-access])
- Remote MCP servers are first-class on Workers (Agents SDK `McpAgent`,
  OAuth provider library).

Estimated cost: Workers Paid plan, **$5/month**.

## Architecture

```
Browser (React SPA, same renderer code)
  │  HttpClient implements IClient (JSON over fetch)
  ▼
Cloudflare Access  ──  authn (email OTP / IdP), free ≤ 50 users
  ▼
Worker (Hono)
  ├── serves static assets (Vite build of the renderer)
  ├── /api/*       → per-user Durable Object (SQLite: documents, journals,
  │                  tags, FTS5 index, shares, preferences)
  ├── /files/*     → R2 (attachments, images, video; keyed users/<id>/...)
  ├── /p/*         → public published notes (blog surface; Access-exempt)
  ├── /share/*     → token-gated read-only note views
  └── /mcp         → remote MCP server (McpAgent), tools from
                     chronicles-mcp.md design
```

- **One Durable Object per user**, named by the Access-verified email. Each
  user literally is their own SQLite database — isolation by construction.
- The Worker validates the Access JWT, resolves the DO, and forwards typed
  requests. No hand-rolled sessions, no password storage.

## Key decisions

### 1. Database as source of truth (decided — reverses desktop model)

The desktop app treats markdown files on disk as source of truth with SQLite
as a rebuildable index. **The cloud version will not replicate this.** Notes
live in SQLite as the single source of truth; the content column stores
markdown text.

Rationale:

- Files-as-truth buys nothing on a server: no Finder, no third-party editors,
  no Dropbox. It costs two-phase writes, move/rename consistency bugs (see
  e.g. `372c9bf` "fix: delete old file when note moves to another journal"),
  and the entire indexer subsystem.
- The application layer continues to *speak markdown* everywhere — paste,
  raw mode, publishing, MCP — markdown remains the content format. Only the
  "one file per note on a filesystem" storage shape is dropped.
- **Export must stay trivial and first-class**: a single pass over
  `documents` emits the exact directory-of-markdown-files layout the desktop
  app uses today. Export is the escape hatch that files-as-truth was really
  buying; keep it tested.
- Longer term the desktop app can adopt the same model (DB as truth,
  export/import instead of live file mirroring), retiring the indexer. Out of
  scope here, but this design should not preclude it.

Attachments are the exception: binary blobs live in R2, referenced from
markdown, mirroring today's `_attachments/` + `chronicles://` scheme.

### 2. Encryption posture (open — leaning Option A with a B-ready design)

The tension: end-to-end encryption is genuinely desirable for a journal, but
the server can only search, render shares, publish, and serve MCP for content
it can read.

Surveyed options:

- **Option A — plaintext + Access (recommended for v1).** Server-side FTS5 in
  the DO. Every feature works. Trust boundary: Cloudflare encrypts at rest
  but can technically read content (as with any server-side app). Access
  closes *exposure*; it does not close *trust*.
- **Option B — full E2EE, client-side search.** The proven pattern (Notesnook,
  Standard Notes): server stores ciphertext blobs + minimal metadata; every
  client holds a local decrypted copy and searches locally. In the browser
  this means SQLite WASM + OPFS with FTS5 in a Web Worker — demonstrated
  viable at far larger corpora than a personal journal (tens of MB).
  Standard envelope crypto: passphrase → Argon2id → master key; per-note data
  keys (XChaCha20-Poly1305) wrapped by the master key. Consequences:
  - The DO becomes a **sync/blob server**, not an `IClient` host — a
    materially different backend.
  - Sharing requires either recipient keypairs (wrap the note key to the
    recipient) or explicit **declassification** (sharing creates a plaintext
    copy — arguably honest, since sharing *is* disclosure).
  - Blog publishing is inherently declassification; unaffected.
  - MCP must run where the key is (local), or behind an unlock step.
  - Multi-device key UX (passphrase entry per device) is real friction.
- **Option C — searchable encryption / blind indexes. Rejected.** HMAC'd
  term indexes leak term frequencies and query patterns, and forfeit prefix,
  phrase, and ranking. Worst of both worlds; no serious notes app ships this.
- **Option D — per-journal encryption tier.** Plaintext journals get
  server-side everything; marked-sensitive journals are E2EE, excluded from
  server search (searched client-side only or not at all). A pragmatic
  compromise at the cost of two code paths.

**Recommendation:** ship v1 as Option A, but make the design *B-ready*:

- Store note content as an opaque versioned envelope:
  `{ v: 1, cipher: "none", data: <markdown> }`. Turning on encryption later
  changes `cipher`, not the schema or API.
- Treat the FTS index as derived and rebuildable, never authoritative.
- Decide A-vs-B (or D) **before Phase 3** (sharing), because B changes what
  the server can do with content. If, after living in v1, plaintext-to-
  Cloudflare remains unacceptable, the move is Option B — accepting that
  search rearchitects to the client (a known, bounded rewrite, and one that
  brings offline support with it). Interim guidance: keep anything
  radioactive in a local-only desktop journal.

### 3. Sync (decided: none in v1)

No two-way desktop↔cloud sync initially. Seed the cloud instance with a bulk
import (run the existing importer/bulk-operations locally, push over the
HTTP API), then treat the cloud as primary and live in it.

If desktop-local remains wanted later: per-note last-write-wins on
`updatedAt` is sufficient for a single author editing discrete notes; CRDTs
are explicitly out of scope. Decision 1 makes this easier — both sides would
sync database rows, not filesystems.

## Data model

Port of `src/node-client/schema.ts` (Drizzle), per-user DO:

- `journals` — as today.
- `documents` — as today, except `content` becomes the opaque envelope
  (markdown inside, `cipher: "none"` for now). Frontmatter fields stay
  promoted to columns as today.
- `document_tags` — as today.
- `files` — metadata only; bytes in R2 under `users/<id>/attachments/...`.
- `documents_fts` — FTS5 virtual table, unchanged port.
- `preferences` — replaces the `Conf` JSON file (key/value table).
- `shares` — new: `(grantee_email, journal_id | document_id, access)`,
  checked after Access identifies the caller.
- `publications` — new: `(document_id, slug, published_at, revoked_at)`;
  drives `/p/<slug>` and any blog-repo push.

## API

`IClient` over HTTP, one route per client method (Hono, JSON bodies, zod at
the boundary). The renderer gains an `HttpClient` implementation selected by
build target; the desktop app keeps its preload client. `SearchRequest`/
`SearchResponse` etc. in `src/preload/client/types.ts` are already
transport-shaped.

Not ported to the Worker: `importer` (runs locally, pushes via API),
filesystem-specific `files` logic (R2 reimplementation), `indexer`
(obsolete under decision 1 — FTS updates happen transactionally on write).

## Sharing

- **Persistent grants:** wife's email in `shares` → after she passes Access
  (email OTP), she sees granted journals/notes read-only in the normal UI.
- **One-off links:** signed share tokens → `/share/<token>` renders a single
  note (plus its attachments) read-only, no login. Token revocable.
- Email-a-copy falls out of export: render note + assets to a bundle.

## Blog publishing

A `published` flag / action on a note creates a `publications` row:

- v1: server-rendered at `/p/<slug>` on the user's domain, Access-exempt,
  styled minimally. The journal *is* the blog.
- Later/alternative: publish action pushes markdown to the blog repo
  (Pages/static) for full control. Both consume the same `publications` row.

## MCP

Remote MCP server on the same Worker (`McpAgent`), HTTP transport — the
"Cloud backend" unblock anticipated in [chronicles-mcp.md](chronicles-mcp.md).
Same five tools: `note_create`, `note_get`, `note_update`, `note_delete`,
`notes_search`. Auth via OAuth or a per-user bearer token minted in
preferences. Under encryption Option B this surface would be limited to
shared/plaintext content or require an unlock step (see decision 2).

## Phases

1. **Spike:** Hono Worker + one DO (Drizzle `durable-sqlite`); port
   `documents`, `journals`, `tags`, FTS5 search from `node-client`;
   `HttpClient` in the renderer; hardcoded single user. Exit criterion: real
   notes rendering and searchable in a browser. Retires most technical risk.
2. **Assets:** R2 attachments, upload path, `chronicles://` → `/files/`
   rewrite in the markdown pipeline.
3. **Auth + sharing:** Access in front, DO-per-email, `shares`, share-token
   links. _Encryption decision checkpoint (decision 2)._
4. **Seed + live in it:** bulk import; PWA manifest; use from phone for a
   while before building any sync.
5. **MCP + publishing:** thin layers over the now-existing API.

Prerequisite: finish the Lexical migration first — don't fork the UI across
two platforms mid-editor-swap.

## Open questions

- Encryption posture (decision 2) — checkpoint before Phase 3.
- Multi-instance story for friends: one deployment multi-user, or
  `wrangler deploy` per person? (Leaning per-person deploys — true
  self-hosting, no tenancy code; revisit.)
- Published-note theming: reuse app themes or a dedicated minimal blog style?
- Desktop convergence: when (if ever) does desktop adopt DB-as-truth and the
  HTTP client against a local server?

## References

- [DO SQLite storage API (FTS5 support)][do-sqlite]
- [SQLite in Durable Objects GA — 10GB][do-ga]
- [DO SQLite storage billing][do-billing]
- [Workers pricing][workers-pricing]
- [Cloudflare Access][cf-access]
- E2EE search prior art: Notesnook / Standard Notes (client-side local
  search over decrypted store; XChaCha20-Poly1305 + Argon2)
- Browser FTS feasibility: SQLite WASM + OPFS with FTS5 (e.g.
  [wa-sqlite discussion](https://github.com/rhashimoto/wa-sqlite/discussions/63),
  [subframe7536/sqlite-wasm](https://github.com/subframe7536/sqlite-wasm))

[do-sqlite]: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
[do-ga]: https://developers.cloudflare.com/changelog/2025-04-07-sqlite-in-durable-objects-ga
[do-billing]: https://developers.cloudflare.com/changelog/post/2025-12-12-durable-objects-sqlite-storage-billing/
[workers-pricing]: https://developers.cloudflare.com/workers/platform/pricing/
[cf-access]: https://www.cloudflare.com/sase/products/access/
