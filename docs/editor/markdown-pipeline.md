# Markdown Pipelines

Chronicles stores notes as markdown files. There are two separate markdown pipelines:

- **Editor roundtrip** (this doc, below) — Lexical's own markdown import/export, used only while a document is open for editing.
- **Indexer / search / import pipeline** — micromark (with OFM extensions) → MDAST → remark, used by the background indexer, full-text search, and bulk import. It does not touch the editor. See `src/markdown/index.ts` and `src/node-client/`.

## Editor Flow (Lexical)

```
Load:  .md file → $loadMarkdownIntoLexical → Lexical EditorState (editor)
Save:  Lexical EditorState → $exportMarkdownFromLexical → .md file
```

Both directions go through `@lexical/markdown`'s `$convertFromMarkdownString` / `$convertToMarkdownString`, driven by a shared list of transformers — there is no intermediate MDAST tree in this path.

## Key Files

| Purpose                       | Location                                           |
| ----------------------------- | -------------------------------------------------- |
| Transformers, load/export fns | `src/views/edit/lexical/lexicalMarkdown.ts`        |
| Custom image node             | `src/views/edit/lexical/ChroniclesImageNode.tsx`   |
| Custom note-link node         | `src/views/edit/lexical/ChroniclesNoteLinkNode.ts` |
| Note-link URL parsing         | `src/markdown/noteLinks.ts` (`parseNoteLink`)      |

## Entry Points (`lexicalMarkdown.ts`)

- **`$loadMarkdownIntoLexical(markdown)`**: parses markdown into the active Lexical editor state (must run inside an `editor.update()`)
- **`$exportMarkdownFromLexical()`**: serializes the active Lexical editor state back to a markdown string (must run inside an `editor.read()`/`editor.update()`)
- **`roundtripLexicalMarkdown(markdown)`**: creates a throwaway headless editor to load and immediately re-export markdown — used for tests
- **`chroniclesLexicalTransformers`**: the full transformer list — Chronicles' custom image/note-link transformers plus `CHECK_LIST` and `@lexical/markdown`'s default `TRANSFORMERS`
- **`lexicalNodes`**: the node classes registered with the editor (headings, quote, lists, code, links, plus `ChroniclesImageNode`/`ChroniclesNoteLinkNode`)

## Custom Transformers

- **`CHRONICLES_IMAGE_TRANSFORMER`**: `ChroniclesImageNode` ↔ `![alt](url)` markdown image syntax
- **`CHRONICLES_NOTE_LINK_TRANSFORMER`**: `ChroniclesNoteLinkNode` ↔ `[text](../journal/note-id.md)` links — detected via `parseNoteLink`, which matches the `../<journal>/<noteId>.md` shape

## Extending

To add a new node type to the editor:

1. Define the Lexical node (`$create*`, `$is*`, serialization) alongside the other custom nodes in `src/views/edit/lexical/`
2. Register it in `lexicalNodes` in `lexicalMarkdown.ts`
3. Write an `ElementTransformer` or `TextMatchTransformer` for it and add it to `chroniclesLexicalTransformers`
4. Create a plugin/component to render it if needed (see [plugins.md](plugins.md))

## Indexer / Search / Import Pipeline

Unchanged by the Lexical migration — still micromark → MDAST → remark, used outside the editor. See `src/markdown/index.ts`, `src/node-client/indexer.ts`, `src/node-client/importer.ts`, and [docs/indexer.md](../indexer.md).
