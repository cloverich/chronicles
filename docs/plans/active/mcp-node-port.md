# Plan: Port MCP Server to Node + Ship in Electron App

## Goal

Replace the Bun-based MCP server with a Node-compatible version bundled inside
the Electron app. After this, Bun is no longer required by any part of the
project and can be removed.

## Context

The MCP stdio server (`src/bun-client/mcp/`) provides CRUD + search tools for
notes. It works today but requires the Bun runtime. Since the project has moved
back to Electron with `better-sqlite3` (node-client), MCP should use the same
stack. The server code is already 99% runtime-agnostic — only the client factory
import is Bun-specific.

## Design

### 1. Port server to node-client

Move `server.ts` and `framing.ts` to `src/mcp/`. Change the single import:

```diff
-import { createClient, type BunClient } from "../factory";
+import { createClient, type NodeClient } from "../node-client/factory";
```

All protocol handling, tool definitions, and helpers are pure Node (`Buffer`,
`process.stdin/stdout`, `path`) and need no changes.

### 2. Bundle with esbuild

Add a third entry point to `scripts/build-main-preload.js`:

```js
await esbuild.build({
  entryPoints: ["src/mcp/server.ts"],
  outfile: "src/mcp-server.bundle.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["better-sqlite3"],
});
```

`better-sqlite3` is externalized because it's a native addon (`.node` file)
that can't be bundled. It resolves from the app's `node_modules/` at runtime.

### 3. Ship in app package

Update `build.sh` to copy `mcp-server.bundle.mjs` into `dist/` alongside
`main.bundle.mjs` and `preload.bundle.mjs`. Also copy the migrations folder
(already copied for main bundle).

The bundled server runs with plain `node`:

```
node /Applications/Chronicles.app/Contents/Resources/app/mcp-server.bundle.mjs
```

### 4. Preferences UI — MCP Integration section

Add an "AI Integration" section to the preferences pane (between "Configuration
files" and "Import directory"). No toggle needed — there's nothing to
enable/disable since MCP hosts spawn the server process themselves.

Contents:

- Brief explanation of what MCP is and what it enables
- Config snippets for Claude Code, Claude Desktop, Gemini CLI, Codex CLI
- "Copy to clipboard" button for each snippet
- Snippets auto-populate the correct path to `mcp-server.bundle.mjs` based on
  the app's install location

The path is resolved at render time. In dev mode it points to
`src/mcp-server.bundle.mjs` in the repo. In production it points into the app
bundle.

### 5. Update design doc

Update `docs/designs/chronicles-mcp.md` to reflect the node-based approach,
remove Bun references, and document the bundled path.

## Open questions

- **better-sqlite3 ABI compatibility**: The copy in the Electron package is
  rebuilt for Electron's Node ABI. System `node` may have a different ABI.
  Need to test. Options if it fails:
  (a) Ship a second copy built for system Node
  (b) Use `electron.app.getPath('exe')` to resolve Electron's node — but that
  launches the full app
  (c) Rebuild for system Node during packaging
  Likely (a) is simplest — `npm rebuild better-sqlite3` for system Node and
  copy alongside.

- **Migration folder path**: `resolveMigrationsFolder()` uses `__dirname`
  heuristics. Need to verify it resolves correctly when running from the app
  bundle via system `node`. May need `CHRONICLES_PROJECT_ROOT` set in the
  MCP config env vars.

## Follow-up: Remove Bun

After this lands, `src/bun-client/` becomes dead code except for the
`migrations/` folder (which is just SQL files, not Bun-specific). A follow-up
PR can:

- Delete `src/bun-client/` (move migrations to a shared location first)
- Remove `bun-types` and `bun` from devDependencies
- Remove `mcp:server` script from package.json
- Update any remaining docs referencing Bun

## Tasks

- [x] Write plan
- [ ] Port MCP server to `src/mcp/` using node-client
- [ ] Add esbuild entry point for `mcp-server.bundle.mjs`
- [ ] Update `build.sh` to include MCP bundle
- [ ] Add "AI Integration" section to preferences UI
- [ ] Update `docs/designs/chronicles-mcp.md`
- [ ] Test: bundle runs with system `node`
- [ ] Test: MCP tools work end-to-end via Claude Code
