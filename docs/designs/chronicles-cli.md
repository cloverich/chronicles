# Design Doc: Chronicles CLI

## High-Level Plan

> **This section is the reference anchor for implementation work.**

### Project Phases

These are project phases, not app version numbers. The CLI ships bundled into Chronicles. It may be split into a standalone package later if there's demand, but the default is: one repo, one app, new entry point.

**Note on Long-term Architecture:** See `docs/designs/framework-comparison-2026.md` for the roadmap beyond Electron, including the potential pivot to a Custom Swift + WebView (Hybrid) approach.

1. **Phase 0: Extract backend from Electron** — Make `IClient` instantiable as plain Node.js, without Electron. This is the prerequisite that de-risks everything else. (See §2)
2. **Phase 1: Read-only CLI + index** — 4 read commands + `index`. zod schemas, `--json`, TTY tables. Smoke tests against fixture directories.
3. **Phase 2: Mutations** — create/update/delete for docs and journals. Full access (no profiles yet).
4. **Phase 3: Access profiles** — Per-journal read/write permissions. Re-run existing smoke tests with profiles applied.
5. **Phase 4: Import + maintenance** — `import`, `config get/set`, shell completions.

MCP is a natural fast-follow (see §7) but is out of scope for this design.

### Guiding Principles

- **No premature abstractions.** CLI commands call IClient methods directly. No intermediate "interface layer" or "transport abstraction" until a second transport (MCP) arrives and reveals the real shared contract.
- **No YAML spec file.** zod schemas in code are the source of truth. If a generated spec is needed later (for MCP tool definitions, shell completions), generate it then.
- **Smoke tests are the primary tests.** Spawn the binary, check stdout and exit codes. This tests the actual product.
- **Ship incrementally.** Each phase is usable on its own. Phase 1 alone is valuable for LLM read access.

---

## 1. Context & Motivation

Chronicles is a local-first markdown journal. Today, all backend functionality is accessed through the Electron Preload Client (`IClient`), which serves as the boundary between the React UI and the backend services (SQLite, filesystem, indexer).

The CLI adds a new entry point into the same backend — not a separate app, but a second way to reach the same data. It enables:

- **LLM integration** — Permission-scoped access for AI agents, without sending private journals to remote servers
- **Scripting & automation** — Pipe-friendly, composable commands
- **Future TUI** — An interactive terminal UI for viewing/editing notes (separate feature, but CLI is the prerequisite)
- **Future MCP** — Once the CLI works, an MCP adapter is a thin wrapper (see §7)

### Why CLI first?

MCP's local transport (stdio) has **no authentication or permission model** — it delegates all access control to the host. Starting with CLI means the permission model is built at the right layer, and MCP inherits it for free when it arrives.

---

## 2. Phase 0: Extract Backend from Electron

> **This is the highest-risk item and must be completed first.**

The `IClient` backend currently lives in `src/preload/` and assumes an Electron context. The CLI needs it to run as plain Node.js. The good news: the Electron surface is small and well-contained.

### Electron-Specific Dependencies (Complete Inventory)

| Dependency               | Files                                                | What it does                                                                           | CLI replacement                                                                                          |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **`electron-store`**     | `preferences.ts`, `files.ts`, `electron/settings.ts` | Settings storage (get/set/path). Used for `notesDir`, `databaseUrl`, `defaultJournal`. | `conf` package (drop-in API-compatible) or plain JSON file. Interface is simple: get, set, delete, path. |
| **`contextBridge`**      | `preload/index.ts`                                   | Exposes client to Electron renderer via `window.chronicles`                            | Not needed. CLI imports `createClient` directly.                                                         |
| **`ipcRenderer`**        | `utils.electron.tsx`, `*.electron-test.ts`           | File dialogs, dev tools, test signaling                                                | Not needed. CLI uses path arguments. Test files use `node:test` directly.                                |
| **`(file as any).path`** | `files.ts:217`                                       | Electron-specific File object with `.path` property                                    | CLI passes file paths directly, not File objects.                                                        |

### What Already Works in Plain Node.js

Everything else: better-sqlite3, knex, sharp, fs, path, crypto, Buffer, streams. All business logic in journals, documents, tags, indexer, importer, bulk operations — pure Node.js.

### Extraction Strategy

The goal is **not** to fork or duplicate the preload client. Instead, make the existing code work in both contexts:

1. **Abstract `electron-store`** behind a simple interface (`ISettingsStore: { get, set, delete, path }`). Electron uses `electron-store`, CLI uses `conf` or a JSON file. This is the only code change needed in the existing clients.
2. **Create a CLI entry point** (`src/cli/index.ts`) that instantiates `IClient` with the non-Electron settings store.
3. **Leave `preload/index.ts` alone** — it continues to serve the Electron app.

### Database Lifecycle

The CLI and Electron app share the same SQLite database and the same `notesDir`. This is intentional — the CLI is a window into the same data, not a copy.

**Concurrent access:** SQLite with WAL mode (which better-sqlite3 supports) handles concurrent readers cleanly. In practice, the Electron app and CLI are unlikely to write simultaneously, but WAL makes it safe if they do. better-sqlite3 is synchronous, so writes serialize naturally within each process.

**Settings sharing:** Both the CLI and Electron app read from the same settings file. `electron-store` and `conf` both use the same underlying format (JSON in `~/.config/chronicles/`). The CLI reads `notesDir` and `databaseUrl` from this shared config — no separate bootstrap needed if the Electron app has been run at least once.

### Success Criteria

Phase 0 is done when:

- `createClient()` can be called from a plain Node.js script (no Electron)
- `client.journals.list()` returns data from the same database the Electron app uses
- `client.indexer.index()` indexes the same `notesDir`
- No Electron process is needed

---

## 3. Command Taxonomy

Mapped from the existing `IClient` interface. Commands use space-separated subcommands: `chronicles <domain> <verb>`.

### Phase 1 — Read-Only + Index

| Command                    | IClient Method              | Category |
| -------------------------- | --------------------------- | -------- |
| `chronicles journals list` | `journals.listWithCounts()` | read     |
| `chronicles docs search`   | `documents.search()`        | read     |
| `chronicles docs get <id>` | `documents.findById()`      | read     |
| `chronicles tags list`     | `tags.allWithCounts()`      | read     |
| `chronicles index`         | `indexer.index()`           | write    |

`index` is in Phase 1 because: (a) tests need it for fixture setup, and (b) it's the first thing you'd run after install.

### Phase 2 — Mutations

| Command                                   | IClient Method               | Category |
| ----------------------------------------- | ---------------------------- | -------- |
| `chronicles docs create`                  | `documents.createDocument()` | write    |
| `chronicles docs update <id>`             | `documents.updateDocument()` | write    |
| `chronicles docs delete <id>`             | `documents.del()`            | delete   |
| `chronicles journals create <name>`       | `journals.create()`          | write    |
| `chronicles journals rename <name> <new>` | `journals.rename()`          | write    |
| `chronicles journals archive <name>`      | `journals.archive()`         | write    |

### Phase 3 — Access Profiles

No new commands. Profile enforcement wraps existing commands. See §5.

### Phase 4 — Import + Maintenance

| Command                               | IClient Method      | Category |
| ------------------------------------- | ------------------- | -------- |
| `chronicles import <dir>`             | `importer.import()` | write    |
| `chronicles config get <key>`         | `preferences.get()` | read     |
| `chronicles config set <key> <value>` | `preferences.set()` | write    |

### Later (Separate Phases)

| Command                                   | Notes                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| `chronicles bulk create` / `bulk process` | Complex multi-step workflow. Add when core CRUD is stable. |
| Shell completions (bash, zsh, fish)       | Nice-to-have polish.                                       |

### Not Exposed (Internal Only)

- `documents.loadDoc()`, `parseDoc()`, `readDocRaw()` — parsing internals
- `documents.createIndex()`, `updateIndex()` — called by `indexer`, not directly
- `documents.getAllDocSyncMeta()`, `updateDocSyncMeta()` — sync internals
- `files.*` — filesystem operations (image upload, folder management) are side effects of other commands
- `knex` — raw database access is never exposed

---

## 4. Interface Spec

### Approach: zod in Code, Not a Spec File

The schemas live in TypeScript as zod definitions. No standalone `cli-spec.yaml`. The code is the spec.

If a generated spec is needed later (for MCP tool definitions, documentation, shell completions), it can be generated from zod via `zod-to-json-schema`. But that's a future concern — don't build the generation pipeline until there's a consumer.

### Portability to Other Languages

The zod schemas are TypeScript-specific, but the **smoke tests are the true spec**. They spawn a binary, pass args, and assert on stdout/exit codes — they don't know or care what language the binary is written in. A Go or Rust rewrite passes the same smoke test suite against the same fixtures, and it's correct.

If a rewrite needs typed schemas (Go structs, Rust types), a one-time `zod-to-json-schema` export provides the bridge. This is a 30-minute task at rewrite time, not infrastructure to build now.

```typescript
// src/cli/schemas.ts
import { z } from "zod";

export const SearchInput = z.object({
  query: z.string().optional().describe("Full-text search query"),
  journal: z.string().optional().describe("Filter to a specific journal"),
  tags: z.array(z.string()).optional().describe("Filter by tags (AND logic)"),
  before: z.string().optional().describe("Documents before this date"),
  limit: z.number().int().max(100).default(20),
});

export const SearchItem = z.object({
  id: z.string(),
  title: z.string().optional(),
  journal: z.string(),
  createdAt: z.string(),
});

// Used for: arg parsing, validation, --help generation, test assertions
```

### Output Schemas for Test Assertions

Each command's output has a zod schema. Smoke tests validate CLI stdout against it:

```typescript
const output = JSON.parse(execSync("chronicles journals list --json"));
JournalListOutput.parse(output); // throws if schema doesn't match
```

This is the "spec conformance" test — mechanical, generated from the schemas, and catches regressions in output shape.

---

## 5. Access Profiles (Permission Model)

> **Phase 3.** Built on top of working read + write commands.

### Threat Model

An LLM agent with CLI access can read journal contents that flow into remote model context. The risk isn't unauthorized users — it's **unscoped data exposure**. The user must be able to say: "this agent can see my work notes but not my diary."

### Design: Named Profiles in Config

```yaml
# ~/.config/chronicles/access.yml

default_profile: full

profiles:
  full:
    description: "Full access (human use)"
    journals: ["*"]
    operations: [read, write, delete]

  llm-work:
    description: "LLM agent — work journals only"
    journals: [work, meetings, "projects/*"]
    operations: [read, write]
    deny_journals: [personal, health, finances]

  llm-readonly:
    description: "LLM agent — read everything except private"
    journals: ["*"]
    operations: [read]
    deny_journals: [personal]
```

### Activation

```bash
# Via flag (highest precedence)
chronicles --profile llm-work docs search "meeting agenda"

# Via env var (set once in shell, MCP config, or Claude Code settings)
CHRONICLES_PROFILE=llm-work chronicles docs search "meeting agenda"

# No flag, no env var → uses default_profile from config
# No profile file at all → full access (no setup burden for human use)
```

### Rules

1. **Deny overrides allow.** If a journal is in both `journals` and `deny_journals`, it is denied.
2. **Glob patterns.** `"projects/*"` matches `projects/alpha`, `projects/beta`, etc.
3. **Operation categories.** Each command has a category (read, write, delete). The profile's `operations` list is checked.
4. **Clear denial errors.** Exit code 3, stderr message with what's allowed and denied.
5. **No profile file = full access.** Backwards-compatible, zero setup for human use.

### Testing Approach

Access profiles are tested by **re-running the existing smoke test suite with profiles applied.** The read/write tests from Phases 1-2 already exist — Phase 3 adds a second pass with restricted profiles and asserts on denials. Plus unit tests for the matching logic (globs, deny-overrides-allow).

---

## 6. Output Contract

Aligned with [docs/cli-authoring.md](../cli-authoring.md): **Stdout for the Answer, Stderr for the Journey.**

### Modes

| Mode               | When                                  | Behavior                               |
| ------------------ | ------------------------------------- | -------------------------------------- |
| **TTY (human)**    | `isatty(stdout)` is true, no `--json` | Pretty tables, colors, aligned columns |
| **JSON (machine)** | `--json` flag or stdout is piped      | One JSON object/array per command      |
| **Quiet**          | `--quiet` flag                        | Exit code only, no stdout              |

### TTY Table Examples

```
$ chronicles journals list
NAME          DOCS  ARCHIVED  CREATED
work            47  no        2024-03-15
personal        23  no        2024-01-02
travel          12  yes       2024-06-20

$ chronicles docs search --query "meeting" --journal work
ID          TITLE                     DATE        TAGS
01j5kx…     Weekly standup notes      2026-02-28  meeting, team
01j5ab…     Q1 planning               2026-02-25  meeting, planning

$ chronicles tags list
TAG            COUNT
meeting           12
planning           8
draft              5
```

### JSON Output

Same data, structured. Schema matches the zod output definitions:

```
$ chronicles journals list --json
[
  {"name": "work", "documentCount": 47, "archived": false, "createdAt": "2024-03-15T00:00:00Z"},
  {"name": "personal", "documentCount": 23, "archived": false, "createdAt": "2024-01-02T00:00:00Z"}
]
```

### Stderr

Progress, warnings, and errors always go to stderr:

```
$ chronicles index
Indexing 3 journals...  ← stderr
  work: 47 documents (2 updated)  ← stderr
  personal: 23 documents (0 updated)  ← stderr
Index complete.  ← stderr
```

### Exit Codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 0    | Success                                         |
| 1    | General error (with message on stderr)          |
| 2    | Usage error (bad args, missing required params) |
| 3    | Permission denied (profile restriction)         |
| 4    | Not found (document, journal doesn't exist)     |

---

## 7. MCP (Out of Scope — Design Notes)

MCP is a strong candidate for fast-follow once the CLI is working. A separate `docs/designs/chronicles-mcp.md` should be created when the time comes.

**Why it will be straightforward:** The CLI commands map 1:1 to MCP tools. The zod input schemas can generate MCP `inputSchema` via `zod-to-json-schema`. The access profile system works via `CHRONICLES_PROFILE` env var, which MCP server configs support natively:

```json
{
  "mcpServers": {
    "chronicles": {
      "command": "chronicles",
      "args": ["mcp-serve"],
      "env": { "CHRONICLES_PROFILE": "llm-work" }
    }
  }
}
```

**Why it's separate:** MCP has its own concerns (tool naming conventions, content block formatting, resource types, streaming) that deserve their own design pass. Don't speculate about them now.

**What the CLI provides to MCP:** Working backend extraction (Phase 0), tested commands, access profile enforcement, zod schemas.

---

## 8. Testing Strategy

The CLI is a standalone binary. The primary test is: **spawn it, check stdout and exit codes.** This is fully independent of the Vitest migration, Playwright E2E, and all UI testing infrastructure.

### Test Layers (in order of importance)

#### Primary: CLI Smoke Tests

Invoke the actual CLI binary against fixture data. Assert on stdout (JSON), stderr, and exit codes. This is the main test suite — it tests the actual product as a user or LLM would use it.

```bash
# Setup: point CLI at fixture directory, index it
export CHRONICLES_NOTES_DIR="$FIXTURE_DIR"
chronicles index

# Test: journals list returns expected data
output=$(chronicles journals list --json)
# assert: valid JSON, contains "work" and "personal", matches output schema

# Test: search finds documents by tag
output=$(chronicles docs search --tags meeting --json)
# assert: results all have "meeting" tag

# Test: profile denial (Phase 3)
CHRONICLES_PROFILE=llm-readonly chronicles docs create --journal personal --content "test"
# assert: exit code 3, stderr contains "does not permit"
```

Framework: `node:test` spawning child processes with `child_process.execFile`. Or shell scripts — the CLI is the interface, the test language doesn't matter much.

**Spec conformance** is a subset of smoke tests: for each command, run it with valid input and validate stdout against the zod output schema. Mechanical, catches regressions in output shape.

#### Secondary: Integration Tests

Backend calls against a real SQLite database with fixture data. Useful for complex query logic and profile enforcement edge cases without spawning processes.

```typescript
const db = knex({ client: "better-sqlite3", connection: ":memory:" });
await runMigrations(db);
const client = createClient(db, fixtureDir);
await client.indexer.index();

// Test: search returns expected results
const results = await client.documents.search({ texts: ["standup"] });
assert(results.data.length > 0);
```

#### Tertiary: Unit Tests

Small, fast tests for pure functions:

- Profile matching logic (glob patterns, deny-overrides-allow)
- zod schema validation (does invalid input reject?)
- Output formatters (table alignment)
- Arg parsing edge cases

### Fixture Data

Fixtures are directories of markdown files. The CLI indexes them on test setup.

```
test/fixtures/
  basic/                          # Standard multi-journal setup
    work/
      2026-01-15-standup.md       # tags: [meeting, team]
      2026-02-01-project-plan.md  # tags: [planning]
    personal/
      2026-01-20-reflection.md    # tags: [journal]
      2026-03-01-health-notes.md  # tags: [health, private]
    _attachments/
      image1.webp
  empty/                          # Empty directory (no journals, no docs)
  single/                         # One journal, one document
    notes/
      2026-01-01-hello.md         # tags: []
```

**Setup per test run:**

1. Copy fixture dir to a temp directory (tests don't mutate fixtures)
2. Set `CHRONICLES_NOTES_DIR` to the temp dir
3. Run `chronicles index` to build the SQLite database
4. Run test commands
5. Clean up temp dir

**What each fixture covers:**

| Fixture   | Tests                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| `empty/`  | Empty results, no crashes, graceful "no journals found"                                     |
| `single/` | Simplest happy path — one journal, one doc                                                  |
| `basic/`  | Multi-journal, tag filtering, search, date filtering, cross-journal queries, profile denial |

### Test Strategy Per Phase

| Phase       | What to test                                                                                                                                                                                                            | How                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Phase 0** | `createClient()` works without Electron. Can list journals, index documents, search.                                                                                                                                    | Integration tests only (no CLI binary yet).             |
| **Phase 1** | Read-only commands produce correct JSON against `basic/` fixture. Empty fixture returns empty arrays, not errors. `index` builds a queryable database.                                                                  | Smoke tests + schema conformance.                       |
| **Phase 2** | Mutations persist and are queryable. `docs create` then `docs get` returns the document. `docs delete` then `docs get` returns exit code 4.                                                                             | Smoke tests against temp dirs (mutations modify state). |
| **Phase 3** | Test the profile system only. Pick a few existing commands (e.g., one read, one write) and run them with profiles applied. Denied operations exit 3. Allowed operations unchanged. Deny-overrides-allow. Glob matching. | Targeted smoke tests + profile unit tests.              |
| **Phase 4** | Import creates documents findable by search. Config get/set persists values.                                                                                                                                            | Smoke tests.                                            |

### Relationship to Existing Infrastructure

This test suite is **fully independent** of the Vitest migration, Playwright E2E, and browser-mode component tests described in [testing-philosophy.md](testing-philosophy.md). It uses `node:test` (or shell scripts) and shares no infrastructure with UI tests. The only shared code is the `IClient` backend, which is stable.

---

## 9. Native Rewrite Strategy

The Node.js CLI (Phases 0–2) is a stepping stone. The backend will be rewritten in a native language, likely Swift.

### Why rewrite?

Chronicles' actual use cases are: macOS desktop app, iOS mobile app, and a CLI for LLM integration. Electron serves the first today but blocks the second entirely. A native backend shared across all three targets is the end state.

### Language evaluation

| Language | CLI | macOS app | iOS app | Cross-platform CLI | Verdict |
|----------|-----|-----------|---------|---------------------|---------|
| **Swift** | Swift Argument Parser | SwiftUI | SwiftUI | Linux yes, Windows rough | Best fit for the product |
| **Go** | Excellent (cobra, etc.) | No native GUI | gomobile (FFI, second-class) | Excellent | Great CLI, wrong app story |
| **Rust** | Good (clap) | No native GUI, but Tauri | Tauri (experimental mobile) | Excellent | Hedge if Tauri matures |

**Swift is the likely choice.** One language across CLI, macOS, and iOS. Swift Package Manager supports multi-target natively:

```
ChroniclesCore/     ← Swift package: SQLite, indexing, search, file ops
ChroniclesCLI/      ← Swift Argument Parser, imports Core
ChroniclesMacOS/    ← SwiftUI, imports Core
ChroniclesIOS/      ← SwiftUI, imports Core
```

**Cross-platform note:** Swift compiles on Linux — the CLI and core library are not Apple-only. Only SwiftUI (the GUI layer) is. A non-Apple GUI would be a separate frontend against the same core. Linux distribution requires the Swift runtime or a statically-linked binary.

### What the Node CLI provides to the rewrite

The Node phase is not throwaway — it produces durable artifacts:

- **Command taxonomy and UX** — the `chronicles <domain> <verb>` surface, validated by use
- **Output schemas** — JSON shapes, exit codes, TTY table formats (zod → Swift Codable / Go structs trivially)
- **Smoke tests** — language-agnostic (spawn binary, check stdout/exit codes). Point them at the new binary.
- **Test fixtures** — the markdown directories
- **Access profile config format** — `access.yml` design (implement in the target language, not Node)

### Revised Node CLI scope

Given the rewrite plan, the Node CLI scope narrows to Phases 0–2. Phase 3 (access profiles) and Phase 4 (import/maintenance) should be implemented directly in the target language.

| Phase | Build in Node? | Rationale |
|-------|---------------|-----------|
| Phase 0: Extract backend | Yes | Forces discovery of the real API surface |
| Phase 1: Read-only + index | Yes | Immediately useful for LLM access |
| Phase 2: Mutations | Yes | Completes the API surface, proves the schema |
| Phase 3: Access profiles | No — defer to rewrite | Enforcement logic is better written once in the target language |
| Phase 4: Import + maintenance | No — defer to rewrite | Low urgency, not needed for the contract |

Phase 0 should be minimal — thin shim to make `IClient` callable from plain Node.js, not a beautiful abstraction. It exists to learn the surface, not to last.

---

## 10. Open Questions (Updated)

- **Content via stdin:** For `docs create`, should content come from stdin, `--file`, or `--content`? Probably all three, with stdin as the default.
- **Attachment handling:** The `files` client handles image upload/processing. In CLI context, probably `chronicles attach <file> --doc <id>` as a separate command.
- **Config bootstrap:** First run needs `notesDir` and `databaseUrl`. If the Electron app has been run, settings already exist. If not, interactive setup in TTY, error with instructions in pipe mode.
- **Rewrite timing:** When to start the Swift rewrite — after Phase 2 is stable, or in parallel? Likely after, so the smoke tests exist first.

---

## 11. Relationship to Existing Docs

| Doc                                          | Relationship                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [cli-authoring.md](../cli-authoring.md)      | Principles this CLI must follow (stdout/stderr discipline, TTY detection, `--json`)          |
| [cli-modernization.md](cli-modernization.md) | Internal tooling standards; `cli-guardian` and `cli-vibe-check` skills apply to this CLI too |
| [architecture.md](../architecture.md)        | Backend architecture that the CLI wraps                                                      |
| [testing.md](../testing.md)                  | Existing test infrastructure (independent of CLI tests)                                      |
| [publishing-system.md](publishing-system.md) | Future: `chronicles publish` command could be added later                                    |

---

## Appendix: Obsidian CLI Comparison

Obsidian released their CLI in Feb 2026. Key differences in approach:

| Aspect               | Obsidian CLI                    | Chronicles CLI                   |
| -------------------- | ------------------------------- | -------------------------------- |
| **Scope**            | Full GUI parity (100+ commands) | Focused on data access + search  |
| **Permission model** | None (all-or-nothing)           | Per-journal access profiles      |
| **Output**           | Silent by default               | Structured (JSON/TTY) by default |
| **LLM integration**  | Not explicitly designed for it  | First-class concern              |
| **TUI**              | Built-in (no-arg mode)          | Separate future feature          |

Chronicles' differentiator is the **permission-scoped, LLM-aware** approach. Obsidian went wide (100+ commands); Chronicles goes deep (fewer commands, but with access control and machine-first output).
