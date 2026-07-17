# Development

```bash
yarn                              # install (postinstall runs electron-rebuild)
HEADLESS=true yarn start          # dev mode; renderer logs in terminal as [RENDERER]
yarn test                         # vitest renderer tests + node-client backend tests
yarn test:node-client             # backend only (node:test, src/node-client/*.test.ts)
yarn test:watch                   # vitest in watch mode
bun run lint                      # prettier (autofix) + tsc --noEmit; matches CI exactly
bun run lint:check                # same but prettier in check mode (no writes)
yarn build                        # production build (electron-packager)
```

### Native modules and the single-ABI test setup

`better-sqlite3` is the only native module needing an ABI-specific build
(`sharp` uses N-API, which is ABI-stable). `postinstall` runs `electron-rebuild`
so it's built for **Electron's** ABI, which the app uses. The node-client tests
therefore run under Electron's own Node (`ELECTRON_RUN_AS_NODE=1 electron …`, see
`test:node-client`) so tests and app share **one** ABI — no rebuild flip.

Do **not** reintroduce `npm rebuild better-sqlite3 --build-from-source` into the
test scripts: it rebuilds for system Node and breaks the app until the next
`electron-rebuild`. If you change the Electron version, run
`yarn run electron-rebuild --force`.

## Workflow

1. Evaluate task or issue (`gh issue view <n>`)
2. Write code
3. `HEADLESS=true yarn start` to verify
4. `bun run lint && bun run test`
5. Commit

## Key Directories

```
src/electron/        Main process (app lifecycle, settings, IPC wiring)
src/node-client/     Drizzle + better-sqlite3 backend (documents, journals, search, import)
src/bun-client/      Drizzle SQL migrations (src/bun-client/migrations/)
src/preload/         IPC bridge, client API types (src/preload/client/types.ts)
src/views/           React views (documents, edit, preferences)
src/components/      Reusable UI (Radix-based)
src/hooks/           React hooks, MobX stores (hooks/stores/)
src/markdown/        Markdown parsing + serialization (indexer, search, import)
```

## Environment Variables

- `CHRONICLES_SETTINGS_DIR`: Overrides the directory for `settings.json` (see `src/electron/settings.ts`).
- `CHRONICLES_USER_DATA`: Overrides Electron's `userData` path for database and local storage (see `src/electron/index.ts`).
- `HEADLESS=true`: Runs the application without showing the main window (useful for background scripts/dev).

## Commits foramt

```
(feat|fix|refactor|chore): lowercase imperative description

- key feature / fix 1
- key feature / fix 2

Justification or elaboration, but only when relevant
```

Bullet points communicate key changes, not dev practices (i.e. "added search by title", not "search by title to dropdown", "add docs for ^", "add spec for ^"...)

## Conventions

- **Database**: SQLite via Drizzle + better-sqlite3. Migrations in `src/bun-client/migrations/`
- **IPC**: All renderer<->main communication through `src/preload/`
- **State**: MobX stores in `src/hooks/stores/`
- **Styling**: Tailwind CSS v4 + Radix UI primitives
- **Editor**: Lexical. See docs/editor/ for details
- **Markdown storage**: Standard markdown + `#tags`, `[[wikilinks]]`, YAML frontmatter
- **Local files**: `chronicles://` protocol for local asset access
