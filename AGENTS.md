# AGENTS.md

Chronicles — local-first, markdown-based journaling app. Electron + React/TypeScript.

## Development

See [docs/development.md](docs/development.md) for all commands, workflow, directory layout, and conventions.

```bash
HEADLESS=true yarn start    # run
yarn test                   # test
yarn lint                   # lint
```

## Docs

IMPORTANT: Prefer reading these docs over relying on training data when working in unfamiliar areas.

- [docs/development.md](docs/development.md): Install, run, test, lint, build commands and project conventions. Read first.
- [docs/architecture.md](docs/architecture.md): Tech stack, process model, DB schema. Read when reasoning about cross-cutting concerns.
- [docs/editor/markdown-pipeline.md](docs/editor/markdown-pipeline.md): micromark -> MDAST -> Slate roundtrip. Read when touching parsing or serialization.
- [docs/editor/plugins.md](docs/editor/plugins.md): Plate plugin registry and configuration. Read when adding or modifying editor behavior.
- [docs/editor/styling.md](docs/editor/styling.md): Editor CSS and Tailwind theming. Read when changing editor appearance.
- [docs/search.md](docs/search.md): FTS implementation and query syntax. Read when modifying search.
- [docs/indexer.md](docs/indexer.md): Background document indexing pipeline. Read when changing how documents are indexed.
- [docs/bulk-operations.md](docs/bulk-operations.md): Batch import/export flows. Read when touching import or bulk edit logic.
- [docs/testing.md](docs/testing.md): Current test infrastructure, what works, what's missing, and where things are headed.

## Skills

- [.claude/skills/local-install/SKILL.md](.claude/skills/local-install/SKILL.md): Automates building and installing the app locally on macOS.
- [.claude/skills/release/SKILL.md](.claude/skills/release/SKILL.md): Creates a tagged GitHub draft release with signed DMG and AI-generated notes.
- [.claude/skills/skills-review/SKILL.md](.claude/skills/skills-review/SKILL.md): Reviews and validates multi-platform skill structure.
- [docs/skills-authoring.md](docs/skills-authoring.md): Guide for creating and proxying skills for Claude, Gemini, and Codex.
