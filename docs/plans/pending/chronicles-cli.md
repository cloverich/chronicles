# Chronicles CLI — Implementation Plan (Phases 0–2)

## Goals

Build a CLI entry point into the existing backend. The CLI is a second way to reach the same data — not a separate app.

1. **Enable LLM integration.** AI agents read/write journals via `chronicles docs search`, `chronicles docs create`, etc. Permission-scoped access comes later (Phase 3, deferred to native rewrite).
2. **Enable scripting.** Pipe-friendly, structured output (`--json`), composable commands.
3. **Prove the API surface.** The CLI commands, output schemas, and smoke tests become the portable contract that survives a future native rewrite.

## Non-Goals

- **Do NOT build access profiles (Phase 3).** Deferred to native rewrite per design doc §9.
- **Do NOT build import/config commands (Phase 4).** Same rationale.
- **Do NOT abstract for MCP yet.** CLI commands call `IClient` methods directly. No intermediate transport layer.
- **Do NOT introduce zod for validation.** Commander handles input validation (required args, types, defaults) and `--help`. Output shapes already have TypeScript interfaces (`JournalWithCount`, `SearchItem`, `GetDocumentResponse`). The smoke tests are the real spec — they're portable to a native rewrite, zod schemas aren't. If MCP needs generated tool definitions later, adding zod output schemas to an existing codebase is a small task. For now, test assertions must be thorough on output shape (check every expected field and type, not just existence) so they serve as the de facto contract.
- **Do NOT fork or duplicate the preload client.** Make the existing code work in both Electron and plain Node.js contexts.

## Design Reference

- [chronicles-cli.md](../designs/chronicles-cli.md) — Full design (command taxonomy, output contract, access profiles, rewrite strategy)
- [cli-authoring.md](../cli-authoring.md) — Stream discipline, TTY detection, `--json` (the style guide)

---

## Implementation Steps

> **This section is the reference anchor for implementation work.**

### Phase 0: Extract Backend from Electron

The preload client is _almost_ plain Node.js already. Three things tie it to Electron:

1. `PreferencesClient` imports `Store` from `electron-store` and uses it as its constructor type
2. `PreferencesClient.set()` / `setMultiple()` call `document.documentElement.dispatchEvent()` — browser-only
3. The singleton in `src/preload/client/index.ts` imports settings from `src/electron/settings.ts` which instantiates `electron-store`

Everything else (knex, better-sqlite3, sharp, fs, all domain clients) is already pure Node.js.

#### Step 0.1: Define a settings store interface

Create `src/preload/client/settings-interface.ts`. Define a minimal `ISettingsStore<T>` interface that both `electron-store` and `conf` satisfy:

```typescript
export interface ISettingsStore<T extends Record<string, any>> {
  get<K extends keyof T>(key: K): T[K];
  get(key: string): unknown;
  set<K extends keyof T>(key: K, value: T[K]): void;
  set(key: string, value: unknown): void;
  set(obj: Partial<T>): void;
  delete<K extends keyof T>(key: K): void;
  readonly path: string;
  readonly store: T;
}
```

#### Step 0.2: Update PreferencesClient to use the interface

In `src/preload/client/preferences.ts`:

- Change the import from `import Store from "electron-store"` to import `ISettingsStore` from the new file
- Change the constructor to accept `ISettingsStore<IPreferences>` instead of `Store<IPreferences>`
- Guard the `document.dispatchEvent` calls with `typeof document !== 'undefined'`

The preload entry still passes an `electron-store` instance — it satisfies `ISettingsStore` already. No behavior change for the Electron app.

#### Step 0.3: Update factory to use the interface

In `src/preload/client/factory.ts`:

- Change `ClientFactoryParams.store` type from `Settings` (which is `Store<IPreferences>`) to `ISettingsStore<IPreferences>`
- Update the `FilesClient` and any other domain client constructors that accept `store` directly — they should also accept `ISettingsStore<IPreferences>`

Grep for all files that import `Store` from `electron-store` or `Settings` from `../../electron/settings` in `src/preload/client/`. Each one needs to use the interface instead.

#### Step 0.4: Create CLI bootstrap

Create `src/cli/bootstrap.ts`. This is the CLI equivalent of `initAppEnvironment`:

```typescript
import Conf from "conf";
import path from "path";
import os from "os";
import { createClient } from "../preload/client/factory.js";
import { IPreferences } from "../electron/settings.js"; // type-only import
import migrate from "../electron/migrations/index.js";

function getDefaultUserDataDir(): string {
  // Match Electron's app.getPath('userData') for "Chronicles"
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Chronicles");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), "Chronicles");
  }
  // Linux / fallback: XDG_CONFIG_HOME
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "chronicles");
}

export function bootstrapCli() {
  const userDataDir = process.env.CHRONICLES_USER_DATA || getDefaultUserDataDir();
  const settingsDir = process.env.CHRONICLES_SETTINGS_DIR || userDataDir;

  const store = new Conf<IPreferences>({
    configName: "settings",
    cwd: settingsDir,
    defaults, // import from settings.ts or inline
  });

  // Resolve notesDir and databaseUrl (same logic as initAppEnvironment)
  const notesDir = store.get("notesDir") || path.join(userDataDir, "notes");
  const databaseUrl = store.get("databaseUrl") || path.join(userDataDir, "chronicles.db");

  // Ensure dirs exist, run migrations
  // Reuse initUserFilesDir and migrate from electron/ — they have no Electron deps
  migrate(databaseUrl);

  return createClient({ store });
}
```

Key decisions:
- **Shared settings location.** The CLI reads/writes the same `settings.json` the Electron app uses. Env vars (`CHRONICLES_USER_DATA`, `CHRONICLES_SETTINGS_DIR`) override for testing or independent use.
- **`initUserFilesDir` and `migrate` are reusable.** They import `fs`, `path`, and `knex` — no Electron. Import them directly.
- **`IPreferences` defaults** — extract the defaults object from `src/electron/settings.ts` into a shared location (or import it; the file's only Electron dep is the `electron-store` import at the top, and we only need the type + defaults).

#### Step 0.5: Verify extraction

Write a throwaway script `src/cli/smoke.ts`:

```typescript
import { bootstrapCli } from "./bootstrap.js";
const client = bootstrapCli();
const journals = await client.journals.list();
console.log(JSON.stringify(journals, null, 2));
```

Run it with `npx tsx src/cli/smoke.ts`. If it prints journals from the same database the Electron app uses, Phase 0 is done. Delete this file afterwards.

**Phase 0 acceptance:** `createClient()` works in plain Node.js. `client.journals.list()` returns data. No Electron process needed.

---

### Phase 1: Read-Only CLI + Index

#### Step 1.1: Install dependencies

```bash
yarn add commander conf
```

- `commander` v13.x — arg parsing, subcommands, help generation
- `conf` — settings store (same author/API as electron-store, without Electron)

#### Step 1.2: Create CLI entry point

Create `src/cli/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { bootstrapCli } from "./bootstrap.js";

const program = new Command();
program.name("chronicles").description("Chronicles CLI").version("0.1.0");

// Register subcommands (imported from separate files)
// program.addCommand(journalsCommand);
// program.addCommand(docsCommand);
// program.addCommand(tagsCommand);
// program.addCommand(indexCommand);

program.parse();
```

Subcommand files live alongside: `src/cli/commands/journals.ts`, `src/cli/commands/docs.ts`, `src/cli/commands/tags.ts`, `src/cli/commands/index-cmd.ts`.

#### Step 1.3: Add esbuild bundle

Add a 4th bundle to `scripts/production.js` (and optionally `scripts/dev.mjs` for development):

```javascript
esbuild.build({
  entryPoints: ["src/cli/index.ts"],
  outfile: "dist/cli.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  banner: { js: "#!/usr/bin/env node" },
  external: ["better-sqlite3", "sharp", "knex", "conf"],
});
```

Add a `"bin"` field to `package.json`: `"bin": { "chronicles": "./dist/cli.mjs" }`.

The CLI binary is separate from the Electron app bundle. It can be linked locally via `yarn link` or `npm link` during development.

#### Step 1.4: Implement commands

Each command follows the same pattern: parse args → call IClient method → format output.

**`chronicles journals list`**
```
Options: --json, --include-archived
Maps to: client.journals.listWithCounts()
Output: table (NAME, DOCS, ARCHIVED, CREATED) or JSON array
```

**`chronicles docs search`**
```
Options: --query <text>, --journal <name>, --tags <t1,t2>, --before <date>, --limit <n>, --json
Maps to: client.documents.search({ texts, journals, tags, before, limit })
Output: table (ID, TITLE, JOURNAL, DATE, TAGS) or JSON array
```

**`chronicles docs get <id>`**
```
Options: --json
Maps to: client.documents.findById({ id })
TTY output: frontmatter header + markdown content
JSON output: { id, title, journal, createdAt, content, frontMatter }
Exit code 4 if not found
```

**`chronicles tags list`**
```
Options: --json
Maps to: client.tags.allWithCounts()
Output: table (TAG, COUNT) or JSON array
```

**`chronicles index`**
```
Options: --full (force full reindex)
Maps to: client.indexer.index(full)
Output: progress on stderr, silent stdout
```

#### Step 1.5: Output formatting

Create `src/cli/output.ts` with two helpers:

- `printTable(rows, columns)` — aligns columns for TTY, prints to stdout
- `printJson(data)` — `JSON.stringify(data, null, 2)` to stdout

All commands check `--json` flag or `!process.stdout.isTTY` to pick the mode. Progress and errors always go to stderr.

#### Step 1.6: Smoke tests

Create `test/cli/` with test files using `node:test`:

```typescript
import { execFileSync } from "child_process";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";

const CLI = "./dist/cli.mjs";

describe("journals list", () => {
  it("returns JSON array", () => {
    const out = execFileSync("node", [CLI, "journals", "list", "--json"], {
      env: { ...process.env, CHRONICLES_USER_DATA: FIXTURE_DIR },
    });
    const journals = JSON.parse(out.toString());
    assert(Array.isArray(journals));
    assert(journals.length > 0);
    assert("name" in journals[0]);
    assert("count" in journals[0]);
  });
});
```

**Fixture setup:** Before test suite runs, copy `test/fixtures/basic/` to a temp dir, point `CHRONICLES_USER_DATA` at it, run `chronicles index`. Tear down after.

**What to test per command:**
- Valid input → expected JSON shape, exit 0
- Empty results → empty array, exit 0 (not an error)
- Not found (`docs get <bad-id>`) → exit 4
- `--json` flag works, stdout is valid JSON
- TTY mode doesn't crash (run without `--json`, assert exit 0)

**Phase 1 acceptance:** All 5 commands work. Smoke tests pass. `chronicles journals list --json` returns real data.

---

### Phase 2: Mutations

#### Step 2.1: Implement mutation commands

**`chronicles docs create`**
```
Options: --journal <name> (required), --title <title>, --tags <t1,t2>
Content source (priority order):
  1. --content "..." (inline)
  2. --file <path> (read from file)
  3. stdin (when piped: !process.stdin.isTTY)
  4. If TTY and no --content/--file: error with usage hint
Maps to: client.documents.createDocument({ journal, content, frontMatter: { title, tags, createdAt } })
Output: JSON { id, journal, path } or "Created <id>" on TTY
```

**`chronicles docs update <id>`**
```
Options: --title <title>, --tags <t1,t2>, --content/--file/stdin (same as create)
Maps to: client.documents.updateDocument({ id, journal, content, frontMatter })
Requires getting existing doc first to merge frontMatter changes
Exit code 4 if not found
```

**`chronicles docs delete <id>`**
```
Options: --journal <name> (required, or discover from DB)
Maps to: client.documents.del(id, journal)
Exit code 4 if not found
```

**`chronicles journals create <name>`**
```
Maps to: client.journals.create({ name })
```

**`chronicles journals rename <name> <new-name>`**
```
Maps to: client.journals.rename(journal, newName)
Exit code 4 if journal not found
```

**`chronicles journals archive <name>`**
```
Maps to: client.journals.archive(name)
```

#### Step 2.2: Content input helper

Create `src/cli/input.ts` — a shared helper for `docs create` and `docs update`:

```typescript
export async function readContent(opts: { content?: string; file?: string }): Promise<string> {
  if (opts.content) return opts.content;
  if (opts.file) return fs.promises.readFile(opts.file, "utf-8");
  if (!process.stdin.isTTY) {
    // Read all of stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf-8");
  }
  throw new Error("Content required: use --content, --file, or pipe via stdin");
}
```

#### Step 2.3: Smoke tests for mutations

Mutation tests run against temp dirs (they modify state). Pattern: create → verify → clean up.

```typescript
describe("docs create → get → delete round-trip", () => {
  it("creates a doc, retrieves it, deletes it", () => {
    // Create
    const created = JSON.parse(execFileSync("node", [
      CLI, "docs", "create", "--journal", "work", "--title", "Test", "--content", "Hello", "--json"
    ], { env }).toString());
    assert(created.id);

    // Get
    const doc = JSON.parse(execFileSync("node", [
      CLI, "docs", "get", created.id, "--json"
    ], { env }).toString());
    assert.equal(doc.title, "Test");

    // Delete
    execFileSync("node", [CLI, "docs", "delete", created.id, "--journal", "work"], { env });

    // Verify gone
    const result = spawnSync("node", [CLI, "docs", "get", created.id, "--json"], { env });
    assert.equal(result.status, 4);
  });
});
```

**Phase 2 acceptance:** All mutation commands work. Round-trip smoke tests pass. Content from stdin works (`echo "hello" | chronicles docs create --journal work --json`).

---

## File Inventory

New files:
```
src/cli/
  index.ts              # Entry point, Commander setup
  bootstrap.ts          # Settings + client initialization
  output.ts             # Table + JSON formatters
  input.ts              # Content reader (stdin/file/inline)
  commands/
    journals.ts         # journals list, create, rename, archive
    docs.ts             # docs search, get, create, update, delete
    tags.ts             # tags list
    index-cmd.ts        # index command

test/cli/
  journals.test.ts      # Smoke tests for journal commands
  docs.test.ts          # Smoke tests for doc commands
  tags.test.ts          # Smoke tests for tag commands
  index.test.ts         # Smoke tests for index command
  helpers.ts            # Fixture setup/teardown, exec helpers

test/fixtures/
  basic/                # Multi-journal fixture (work/, personal/)
  empty/                # Empty dir (no journals)
  single/               # One journal, one doc
```

Modified files:
```
src/preload/client/settings-interface.ts  # New: ISettingsStore interface
src/preload/client/preferences.ts         # Use ISettingsStore, guard DOM events
src/preload/client/factory.ts             # Use ISettingsStore in params
src/preload/client/files.ts               # Use ISettingsStore (if it takes store directly)
scripts/production.js                     # Add CLI esbuild bundle
package.json                              # Add deps (commander, conf), add bin field
```

## Ordering & Dependencies

```
0.1 settings interface ──→ 0.2 update PreferencesClient ──→ 0.3 update factory
                                                                    │
                                                               0.4 CLI bootstrap
                                                                    │
                                                               0.5 verify extraction
                                                                    │
                                              ┌─────────────────────┤
                                              │                     │
                                         1.1 install deps      1.2 entry point + build
                                              │                     │
                                              └──────┬──────────────┘
                                                     │
                                                1.4 implement commands ← 1.3 esbuild bundle
                                                     │
                                                1.5 output formatting
                                                     │
                                                1.6 smoke tests
                                                     │
                                                2.1 mutation commands
                                                     │
                                                2.2 content input helper
                                                     │
                                                2.3 mutation smoke tests
```

Each step is individually verifiable. A step that breaks the Electron app is a bug — the interface abstraction must be backwards-compatible.
