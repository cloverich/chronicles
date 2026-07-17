# Editor Plugins

Chronicles uses Lexical with a plugin-based architecture. For conventions when writing a new plugin (portal-to-`document.body` pattern, one-plugin-per-file, theme classes over inline styles), see [docs/editor/lexical.md](lexical.md).

## Configuration

Editor setup is in [`src/views/edit/lexical/LexicalBasedEditor.tsx`](../../src/views/edit/lexical/LexicalBasedEditor.tsx), which wires nodes, theme, and plugins into `LexicalComposer`.

## Built-in Plugins

From `@lexical/react`:

| Plugin                   | Purpose                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RichTextPlugin`         | Core rich-text editing surface + content editable                                                                                                                              |
| `HistoryPlugin`          | Undo/redo                                                                                                                                                                      |
| `LinkPlugin`             | Hyperlinks                                                                                                                                                                     |
| `ListPlugin`             | Ordered/unordered lists                                                                                                                                                        |
| `CheckListPlugin`        | Checklist items                                                                                                                                                                |
| `MarkdownShortcutPlugin` | Markdown-style typing shortcuts (`#` → h1, etc.), configured with Chronicles' transformers (`chroniclesLexicalTransformers`, see [markdown-pipeline.md](markdown-pipeline.md)) |
| `OnChangePlugin`         | Notifies the `EditableDocument` store of content changes                                                                                                                       |

## Custom Plugins

Located in `src/views/edit/lexical/`, one plugin per file:

| Plugin                             | Purpose                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `LexicalBlockShortcutsPlugin`      | Block-level keyboard shortcuts (e.g. code block entry/exit behavior)                                   |
| `LexicalCheckListShortcutPlugin`   | Converts `[ ] `/`[x] ` typed in a bullet list into a checklist item                                    |
| `LexicalCodeHighlightPlugin`       | Registers syntax highlighting for code blocks                                                          |
| `LexicalCodeLanguagePlugin`        | Floating language picker + copy button for code blocks (portal pattern)                                |
| `LexicalFormattingShortcutsPlugin` | Cmd-based text formatting shortcuts                                                                    |
| `LexicalListBehaviorPlugin`        | Tab/Shift-Tab indent/outdent behavior for lists                                                        |
| `LexicalImageUploadPlugin`         | Drag-drop and paste image upload                                                                       |
| `LexicalPasteLinkPlugin`           | Turns pasted URLs into links over the current selection                                                |
| `LexicalLinkToolbarPlugin`         | Floating edit/unlink toolbar for links (portal pattern)                                                |
| `LexicalNoteLinkPlugin`            | `@`-triggered note search dropdown + note-link node interactions (portal pattern, keyboard navigation) |

## Custom Nodes

Located alongside the plugins in `src/views/edit/lexical/`:

- **`ChroniclesNoteLinkNode`** (`ChroniclesNoteLinkNode.ts`): internal note links, parsed via `parseNoteLink` from `src/markdown/noteLinks.ts`
- **`ChroniclesImageNode`** (`ChroniclesImageNode.tsx`): images/local file references

## Adding a New Plugin

1. Create a new file in `src/views/edit/lexical/` following the portal/one-plugin-per-file conventions in [lexical.md](lexical.md)
2. Register it as a child of `LexicalComposer` in `LexicalBasedEditor.tsx`
3. If the plugin introduces a new node type, register the node with `LexicalComposer` and extend `chroniclesLexicalTransformers` in `lexicalMarkdown.ts` so it round-trips to/from markdown
