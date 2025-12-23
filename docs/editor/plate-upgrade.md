# Plate.js Upgrade: v34 → v48

Completed December 2024.

## Version Summary

| Package          | Old      | New      |
| ---------------- | -------- | -------- |
| `@udecode/plate` | ^34.1.0  | ^48.0.5  |
| `@udecode/cn`    | ^29.0.1  | ^48.0.3  |
| `slate`          | ^0.101.5 | ^0.114.0 |
| `slate-react`    | ^0.101.5 | ^0.114.0 |
| `slate-history`  | ^0.100.0 | ^0.113.0 |
| `slate-dom`      | —        | ^0.114.0 |

## Key Changes

### 1. Plugin API

```typescript
// Old: createPluginFactory
createPluginFactory({
  key: "myPlugin",
  isElement: true,
  withOverrides: (editor) => { ... },
});

// New: createPlatePlugin
createPlatePlugin({
  key: "myPlugin",
  node: { isElement: true },
}).overrideEditor(({ editor }) => { ... });
```

### 2. Editor Setup

```typescript
// Old: createPlugins()
const plugins = createPlugins([...], { components: {...} });
<Plate plugins={plugins}>

// New: usePlateEditor()
const editor = usePlateEditor({ plugins: [...], components: {...} });
<Plate editor={editor}>
```

### 3. Import Paths

| Old                       | New                      |
| ------------------------- | ------------------------ |
| `@udecode/plate-common`   | `@udecode/plate/react`   |
| `@udecode/plate-core`     | `@udecode/plate`         |
| Feature-specific packages | `@udecode/plate-*/react` |

### 4. Slate API

Plate helper functions replaced with direct Slate methods:

| Old (Plate)         | New (Slate)                |
| ------------------- | -------------------------- |
| `getEditorString()` | `Editor.string()`          |
| `getPointBefore()`  | `Editor.before()`          |
| `insertNodes()`     | `Transforms.insertNodes()` |
| `moveSelection()`   | `Transforms.move()`        |
| `isEndPoint()`      | `Editor.isEnd()`           |

### 5. `asChild` Prop Removed

PlateElement no longer uses Radix's `asChild` pattern:

```tsx
// Old
<PlateElement asChild><>{children}</></PlateElement>

// New
<PlateElement>{children}</PlateElement>
```

### 6. Immutable Nodes

Slate nodes are now frozen. Don't mutate directly—use Transforms.

## Compatibility Shim

Created `src/views/edit/editor/plate-types.ts` for element/mark constants:

```typescript
import { ELEMENT_H1, MARK_BOLD } from "./plate-types";
```

## Resources

- [Plate.js Migration Guide](https://platejs.org/docs/migration)
- [createPlatePlugin API](https://platejs.org/docs/plugin)
