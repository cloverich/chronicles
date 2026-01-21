import {
  useEditorRef,
  useEditorSelection,
  useEditorVersion,
} from "platejs/react";
import React from "react";
import { Editor, Range, Text } from "slate";
import { Icons } from "../../../../../components/icons";
import { ToolbarButton } from "../../components/Toolbar";

/**
 * Toolbar buttons for marks - bold, italic, underline, strikethrough, code, link
 * that show up in the editor toolbar.
 *
 * https://platejs.org/docs/components/mark-toolbar-button
 */
export const MarkToolbarButton = React.forwardRef<
  React.ElementRef<typeof ToolbarButton>,
  React.ComponentPropsWithoutRef<typeof ToolbarButton> & {
    nodeType: string;
    icon: keyof typeof Icons;
    clear?: string | string[];
  }
>(({ icon, clear, nodeType, ...rest }, ref) => {
  const editor = useEditorRef();
  const selection = useEditorSelection();
  const version = useEditorVersion() || 0;
  const debouncedSelection = useDebouncedSelection(selection, 150, version);
  const pressed = isMarkActive(editor as any, nodeType, debouncedSelection);
  const Icon = Icons[icon];

  return (
    <ToolbarButton
      ref={ref}
      {...rest}
      size="inherit"
      pressed={pressed}
      onMouseDown={(event) => {
        event.preventDefault();
        const clears = Array.isArray(clear) ? clear : clear ? [clear] : [];
        clears.forEach((mark) => Editor.removeMark(editor as any, mark));

        if (pressed) {
          Editor.removeMark(editor as any, nodeType);
        } else {
          Editor.addMark(editor as any, nodeType, true);
        }
      }}
    >
      <Icon size={16} />
    </ToolbarButton>
  );
});

MarkToolbarButton.displayName = "MarkToolbarButton";

function isMarkActive(
  editor: Editor,
  mark: string,
  selection: Editor["selection"],
) {
  if (!selection) return false;

  try {
    // Validate that the selection paths still exist in the document
    // before trying to access them. This prevents crashes when a stale
    // selection references paths that were deleted.
    if (!Editor.hasPath(editor, selection.anchor.path)) return false;
    if (!Editor.hasPath(editor, selection.focus.path)) return false;

    // No selection, check where the active cursor is
    if (Range.isCollapsed(selection)) {
      const marks = Editor.marks(editor) as Record<string, unknown> | null;
      return Boolean(marks?.[mark]);
    }

    // Selection of text / blocks. Inspect text nodes, and see if this mark is active.
    // Text node is like: { text: "Hello", bold: true }, and mark is like "bold".
    // Logic below triggers if selection starts or ends with a text node that has this mark.
    const firstMatch = Editor.nodes(editor, {
      at: selection,
      match: Text.isText,
      mode: "lowest",
    }).next().value?.[0] as Text | undefined;
    if (firstMatch && mark in firstMatch) return true;

    const lastMatch = Editor.nodes(editor, {
      at: selection,
      match: Text.isText,
      mode: "lowest",
      reverse: true,
    }).next().value?.[0] as Text | undefined;
    if (lastMatch && mark in lastMatch) return true;

    return false;
  } catch {
    // Selection paths may be stale after document changes (e.g., deletions).
    // Return false gracefully rather than crashing the editor.
    return false;
  }
}

function useDebouncedSelection(
  selection: Editor["selection"],
  delayMs: number,
  version: number,
) {
  const [debounced, setDebounced] =
    React.useState<Editor["selection"]>(selection);

  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(selection), delayMs);
    return () => window.clearTimeout(handle);
  }, [selection, delayMs, version]);

  return debounced;
}
