# Design Doc: Chronicles Web (local / self-hosted)

> **Status: Speccing.** This is the active web direction, superseding
> [cloud-web.md](cloud-web.md) (Cloudflare/Durable Objects), which is deferred
> for cost-risk reasons documented there. Nothing here is implemented yet.
> Prerequisite: finish removing Plate (see
> [lexical-evaluation.md](lexical-evaluation.md)).

## The idea

A plain **Node + SQLite web server** that serves the existing React renderer
and implements `IClient` over HTTP. Runs anywhere:

- **Today:** on the author's laptop / a home box, reached from phone and work
  laptop over **Tailscale** (no public exposure, no auth to build for v1).
- **Later:** on a **fixed-price VPS** ($4–6/mo DigitalOcean/Hetzner, co-located
  near the author) once it should be reachable without Tailscale, with real
  auth in front.

This proves out the entire web architecture — the `HttpClient` seam, serving
the renderer, the media pipeline — on boring, predictable infrastructure before
committing to anything exotic.

### Why this over Cloudflare (for now)

Fixed-price hosting has a **predictable ceiling by construction** — no metered
billing, no denial-of-wallet tail (see [cloud-web.md](cloud-web.md) for the full
cost analysis). It also reuses the existing `node-client` **directly** — that
module is already Node + Drizzle + better-sqlite3 — so there's far less new
surface than Durable Objects. And the web build is a **minimal refactor** away
from a future Cloudflare/DO backend if scale ever demands it: same `IClient`
over HTTP, different data layer behind the server.

## Why the codebase fits (same seam as cloud-web)

1. **The client seam exists.** The renderer reaches the backend only through
   `window.chronicles.getClient()` → `IClient` (`src/hooks/useClient.ts`,
   `src/preload/client/types.ts`). Swap that factory for an `HttpClient` that
   fetches to the server and the entire UI runs in a browser unchanged.
2. **`node-client` IS the server.** It already implements every `IClient`
   domain (documents, journals, tags, search + FTS5, preferences, files,
   indexer, importer, bulkOperations) against SQLite on the local filesystem.
   The web server is a thin HTTP wrapper around it.

## Architecture

```
Browser (React SPA — same renderer code)
  │  HttpClient implements IClient (JSON over fetch)
  ▼
Tailscale (v1)  |  reverse proxy + auth (v2, VPS)
  ▼
Node HTTP server (Hono or Express)
  ├── serves static assets (Vite build of the renderer)
  ├── /api/*    → node-client (SQLite: documents, journals, tags, FTS5, prefs)
  ├── /files/*  → local filesystem attachments (native HTTP Range support)
  ├── /p/*      → public published notes (blog surface)          [v2]
  ├── /share/*  → token-gated read-only note views               [v2]
  └── /mcp      → remote MCP server over HTTP                     [v2]
```

Single process, single SQLite DB, single user for v1. Multi-user (if ever) is a
later concern — for the author + a couple of people, per-person deploys are
simpler than tenancy code.

## What changes vs. the desktop app

The desktop app and this server share `node-client`. The deltas:

- **Transport.** Renderer talks HTTP (`HttpClient`) instead of Electron IPC
  (`window.chronicles`). Selected by build target.
- **Media pipeline.** Electron's `chronicles://` protocol handler is replaced
  by a `/files/*` route serving attachments over HTTP — which brings **native
  Range support**, unblocking the video/large-image work deferred out of the
  Lexical migration. This is where Lexical Phase 7 (media) actually lands.
- **Auth (v2 only).** v1 relies on Tailscale for network-level access control
  and builds no auth. v2 (public VPS) needs auth in front — options TBD
  (reverse-proxy basic auth, an OAuth proxy like oauth2-proxy, or app-level).

## Decisions carried over from cloud-web

These were decided during the Cloudflare speccing and still hold; see
[cloud-web.md](cloud-web.md) for full rationale:

- **Database as source of truth** (target). The desktop model is files-as-truth
  - SQLite index; the web target is SQLite-as-truth with export-to-markdown as a
    first-class, always-tested escape hatch. Markdown stays the content format
    everywhere. **MVP note:** the fastest proof reuses `node-client` _as-is_
    (files-as-truth + index), then simplifies to DB-as-truth as a follow-on —
    don't let the model change block the first working web build.
- **No two-way desktop↔web sync in v1.** Seed the web instance via bulk import
  (run the existing importer locally, push over the API), then treat one as
  primary. Per-note last-write-wins on `updatedAt` if sync is ever wanted;
  CRDTs out of scope.
- **Encryption:** default plaintext behind network/auth boundary; keep note
  content in an opaque versioned envelope (`{ v, cipher, data }`) so E2EE can be
  turned on later without a schema/API change. Full E2EE (client-side search via
  SQLite WASM + OPFS) remains a possible future, with the same tradeoffs
  (search/sharing/blog/MCP move client-side or require declassification).
- **Sharing, blog publishing, MCP:** same shapes as cloud-web, all v2. Sharing =
  a `shares` table + signed share-token links. Publishing = a `publications`
  row rendered at `/p/<slug>` (or pushed to a separately-hosted blog). MCP = an
  HTTP MCP server on the same process — the unblock anticipated in
  [chronicles-mcp.md](chronicles-mcp.md).

## Phases

1. **Spike:** Node server (Hono) wrapping `node-client`; `HttpClient`
   implementing `IClient`; serve the Vite build; single hardcoded user; reach it
   from the laptop browser over Tailscale. Exit: real notes render, edit, and
   search in a browser. Reuses `node-client` as-is — minimal new code.
2. **Media pipeline:** `/files/*` route (Range support), upload path, rewrite
   `chronicles://` → `/files/` in the markdown pipeline. Land the deferred
   video/large-image handling here.
3. **VPS + auth:** deploy to a fixed-price droplet; put auth in front; PWA
   manifest for phone. _Auth mechanism decision here._
4. **Seed + live in it:** bulk import from desktop; daily use from phone / work
   laptop.
5. **Sharing, publishing, MCP:** the v2 surfaces above, incrementally.

Then, if scale ever demands it, [cloud-web.md](cloud-web.md) becomes a data-layer
swap behind the same HTTP server.

## Open questions

- Server framework: Hono (edge-portable, eases a future Cloudflare move) vs.
  Express (boring, familiar). Leaning **Hono** to keep the DO door cheap.
- v2 auth mechanism (reverse-proxy vs. oauth2-proxy vs. app-level).
- DB-as-truth cutover timing (MVP reuses node-client's files-as-truth first).
- Blog hosting: same VPS vs. a separate fixed/free-tier static host.
- Forking: this web work likely lands in a **fork** to avoid dragging Electron
  tooling off the rails — decide fork-with-history vs. fresh repo when starting.

## References

- [cloud-web.md](cloud-web.md) — the deferred Cloudflare design + cost analysis
- [chronicles-mcp.md](chronicles-mcp.md) — MCP tool surface (HTTP transport is
  the listed unblock)
- [lexical-evaluation.md](lexical-evaluation.md) — Plate removal prerequisite;
  media pipeline is where deferred Lexical media work lands
