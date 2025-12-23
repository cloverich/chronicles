# Markdown/Slate Pipeline

Chronicles stores notes as markdown files. The editor uses Slate/Plate internally.

## Flow

```
Load:  .md file → parse → MDAST → mdastToSlate → Slate nodes (editor)
Save:  Slate nodes → slateToMdast → MDAST → stringify → .md file
```

## Key Files

| Purpose              | Location                                                      |
| -------------------- | ------------------------------------------------------------- |
| Entry functions      | `src/markdown/index.ts`                                       |
| MDAST → Slate        | `src/markdown/remark-slate-transformer/.../mdast-to-slate.ts` |
| Slate → MDAST        | `src/markdown/remark-slate-transformer/.../slate-to-mdast.ts` |
| Image gallery xforms | `src/views/edit/editor/features/images/toMdast.ts`            |
| Note link xforms     | `src/views/edit/editor/features/note-linking/toMdast.ts`      |

## Entry Points

- **`stringToSlate(md)`**: Load markdown for editing
- **`slateToString(nodes)`**: Save editor state to markdown

## Node Type Mappings

| MDAST            | Slate            | Notes                           |
| ---------------- | ---------------- | ------------------------------- |
| `paragraph`      | `p`              | Plate uses short keys           |
| `heading`        | `h1`-`h6`        | Depth → type                    |
| `list` (ordered) | `ol`             |                                 |
| `list` (bullet)  | `ul`             |                                 |
| `code`           | `code_block`     | Contains `code_line` children   |
| `link`           | `a`              | → `noteLinkElement` if .md link |
| `image`          | `img` or `video` | Extension determines type       |

## Custom Node Types

- **`noteLinkElement`**: Internal note links (detected by .md suffix)
- **`imageGalleryElement`**: Consecutive images grouped for display
- **`video`**: Video files stored as images in markdown

## Extending

To add a new node type:

1. Add case to `mdast-to-slate.ts` `createSlateNode()`
2. Add case to `slate-to-mdast.ts` `createMdastNode()`
3. Create Plate plugin for rendering
4. Extend MDAST types if needed
