# Development

```bash
yarn                              # install
yarn run electron-rebuild --force # rebuild native deps (after Electron/Node change)
HEADLESS=true yarn start          # dev mode; renderer logs in terminal as [RENDERER]
yarn test                         # node --test, files: *.test.ts -> *.test.bundle.mjs
yarn lint                         # prettier + tsc --noEmit
yarn run lint:prettier:write      # autofix formatting
yarn run lint:types:check         # type-check only
yarn build                        # production build (electron-packager)
```

## Workflow

1. Evaluate task or issue (`gh issue view <n>`)
2. Write code
3. `HEADLESS=true yarn start` to verify
4. `yarn lint && yarn test`
5. Commit

## Key Directories

```
src/electron/        Main process, DB migrations (Knex)
src/preload/         IPC bridge, client API types (src/preload/client/types.ts)
src/views/           React views (documents, edit, preferences)
src/components/      Reusable UI (Radix-based)
src/hooks/           React hooks, MobX stores (hooks/stores/)
src/markdown/        Markdown parsing + serialization
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

- **Database**: SQLite via Knex. Migrations in `src/electron/migrations/`
- **IPC**: All renderer<->main communication through `src/preload/`
- **State**: MobX stores in `src/hooks/stores/`
- **Styling**: Tailwind CSS v4 + Radix UI primitives
- **Editor**: Slate.js / Plate. See docs/editor/ for details
- **Markdown storage**: Standard markdown + `#tags`, `[[wikilinks]]`, YAML frontmatter
- **Local files**: `chronicles://` protocol for local asset access
