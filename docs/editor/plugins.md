# Editor Plugins

Chronicles uses Plate.js v48 with a plugin-based architecture.

## Configuration

Main editor setup is in `src/views/edit/editorv2/PlateContainer.tsx`:

```typescript
const editor = usePlateEditor({
  plugins: [...],
  components: {
    [ELEMENT_H1]: HeadingElement,
    // ...
  },
});

<Plate editor={editor}>{children}</Plate>
```

## Built-in Plugins

From `@platejs` packages:

| Plugin             | Purpose                           |
| ------------------ | --------------------------------- |
| `ParagraphPlugin`  | Paragraph blocks                  |
| `BlockquotePlugin` | Blockquotes                       |
| `CodeBlockPlugin`  | Fenced code blocks with syntax    |
| `BoldPlugin`, etc. | Text formatting marks             |
| `LinkPlugin`       | Hyperlinks with floating toolbar  |
| `ListPlugin`       | Ordered/unordered lists           |
| `AutoformatPlugin` | Markdown shortcuts (# → h1, etc.) |
| `ExitBreakPlugin`  | Cmd+Enter to exit blocks          |

## Custom Plugins

Located in `src/views/edit/editor/`:

### Note Linking (`features/note-linking/`)

- **`createNoteLinkDropdownPlugin`**: `@` trigger → document search dropdown
- **`createNoteLinkElementPlugin`**: Renders note links as clickable elements

### Images (`features/images/`)

- **`createImageGalleryPlugin`**: Groups consecutive images as gallery
- **`createMediaUploadPlugin`**: Drag-drop and paste upload
- **`createNormalizeImagesPlugin`**: Ensures proper image node structure

### Utilities (`plugins/`)

- **`createCodeBlockNormalizationPlugin`**: Code block paste handling
- **`createInlineEscapePlugin`**: Space to escape inline elements

## Plugin Structure (v48)

```typescript
import { createPlatePlugin } from "@platejs/react";

export const MyPlugin = createPlatePlugin({
  key: "myPlugin",
  node: {
    isElement: true,
    isInline: false,
    isVoid: false,
  },
  // Keyboard handlers
  handlers: {
    onKeyDown: (editor, plugin) => (event) => { ... },
  },
})
// Override editor methods
.overrideEditor(({ editor }) => {
  const { insertText } = editor;
  editor.insertText = (text) => { ... };
  return editor;
});
```

## Adding a New Plugin

1. Create plugin in `plugins/` or `features/[name]/`
2. Use `createPlatePlugin()` with node config
3. Create React component if needed
4. Register in `PlateContainer.tsx` components
5. Add to markdown transformers if custom node type
