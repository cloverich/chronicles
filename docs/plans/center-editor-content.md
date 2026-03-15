# Plan: Center editor content with breakout elements

## Goal

Center the editor content column on the page. Text-like blocks (paragraphs, headings, blockquotes, lists) should be constrained to prose width (768px) and centered. Media blocks (code blocks, images, galleries) should break out beyond prose width and fill the wider container.

## Current layout architecture

```
EditorContainer          flex h-screen flex-col overflow-hidden
  ScrollContainer        flex grow flex-col overflow-y-auto p-12
    inner div            flex w-full grow flex-col
      FrontMatter
      content div        flex grow pt-6
        PlateContent     font-body min-h-full w-full
          -> block elements (paragraph, heading, code, image, etc.)
```

## Key files

| File                                         | Role              | Current width behavior                                            |
| -------------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `src/views/layout.tsx`                       | `ScrollContainer` | `p-12` — outer padding only, no centering                         |
| `src/views/edit/editorv2/EditorLayout.tsx`   | Inner wrapper     | `flex w-full grow flex-col` — full width, no max-width or mx-auto |
| `src/views/edit/editorv2/PlateContainer.tsx` | PlateContent      | `w-full` — stretches to fill                                      |

## Per-element width constraints

| Element            | File                                                              | Current width class               | Action                                     |
| ------------------ | ----------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Paragraph          | `src/views/edit/editorv2/features/ParagraphElement.tsx`           | `max-w-prose min-w-prose` (768px) | Remove `min-w-prose`, add `mx-auto w-full` |
| Blockquote         | `src/views/edit/editorv2/features/BlockQuoteElement.tsx`          | `max-w-prose`                     | Add `mx-auto w-full`                       |
| Heading            | `src/views/edit/editorv2/features/HeadingElement.tsx`             | None                              | Add `max-w-prose mx-auto w-full`           |
| Lists (ul/ol/task) | `src/views/edit/editorv2/features/list-item/ListItem.tsx`         | None                              | Add `max-w-prose mx-auto w-full`           |
| Code block         | `src/views/edit/editorv2/features/code-block/CodeBlockNode.tsx`   | None — full width                 | **No change (breakout)**                   |
| Image              | `src/views/edit/editorv2/features/images/ImageElement.tsx`        | `max-w-full` on img               | **No change (breakout)**                   |
| Image gallery      | `src/views/edit/editorv2/features/images/ImageGalleryElement.tsx` | Full width flex                   | **No change (breakout)**                   |
| Video              | `src/views/edit/editorv2/features/images/VideoElement.tsx`        | `max-w-[80%] mx-auto`             | Already centered, **no change**            |

## CSS variables (src/index.css)

- `--max-w-prose: 768px` — drives the custom `max-w-prose` and `min-w-prose` utilities
- `--max-w-code: var(--max-w-prose)` — exists but unused currently

## Implementation steps

1. In `EditorLayout.tsx`, add `items-center` to the inner `div` (the one with `flex w-full grow flex-col`) so child blocks center horizontally.

2. In `PlateContainer.tsx`, the `PlateContent` already has `w-full`. No change needed.

3. Update prose-width elements to self-center:
   - **ParagraphElement.tsx**: Change `min-w-prose mt-px mb-4 max-w-prose px-0` to `mt-px mb-4 max-w-prose w-full px-0` (drop `min-w-prose`, add `w-full`). The `mx-auto` is not needed if the parent flex has `items-center`, but `w-full` ensures it stretches up to `max-w-prose`.
   - **BlockquoteElement.tsx**: Add `w-full` to existing classes.
   - **HeadingElement.tsx**: Add `max-w-prose w-full` to the base cva class string (`"relative mb-1"` -> `"relative mb-1 max-w-prose w-full"`).
   - **ListItem.tsx**: Add `max-w-prose w-full` to the base cva class string for `listVariants` (`"m-0 py-1 ps-6"` -> `"m-0 py-1 ps-6 max-w-prose w-full"`). Also add to TaskListElement's class string.

4. Breakout elements (code blocks, images, galleries, video) — leave unchanged. They have no `max-w-prose` and will fill the container width naturally.

5. Check FrontMatter component (`src/views/edit/FrontMatter.tsx`) — it should also get `max-w-prose w-full` and be centered consistently with prose content.

## Validation

Run `HEADLESS=true yarn start`, open an existing document that contains headings, paragraphs, lists, code blocks, and images. Verify:

- Text content is centered and constrained to ~768px
- Code blocks and images extend wider than the text column
- No horizontal scrollbar appears
- Editor is still usable (cursor, typing, selection all work)
