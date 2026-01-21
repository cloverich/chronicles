import { useEditorRef } from "platejs/react";
import React from "react";
import { Editor, Transforms } from "slate";
import { ReactEditor } from "slate-react";

/**
 * Focus the editor when clicking on surrounding layout containers.
 */
export function useFocusEditor(
  className: string = "[data-slate-editor='true']",
) {
  const editor = useEditorRef();

  return React.useCallback(
    (e?: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e?.target !== e?.currentTarget) return;

      e?.preventDefault();

      // const end = Editor.end(editor as any, []);

      // oddly, editor.tf.focus() does not work, but this does.
      const editable = document.querySelector(className) as HTMLElement | null;

      if (editable) {
        editable.focus();
      } else {
        console.warn("useFocusEditor: no editable element found");
      }
    },
    [editor],
  );
}

/**
 * NOTE: Compared to ^ this is better, but doesn't work...
 */
export function useFocusEditor2() {
  const editor = useEditorRef();
  return (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.target === e.currentTarget && !ReactEditor.isFocused(editor as any)) {
      focusSafely(editor as any);
    }
  };
}

/**
 * Attempt to focus at selection, and fallback to focusing at the end of the document.
 */
function focusSafely(editor: any) {
  // pick a guaranteed-mappable point
  const fallback = Editor.end(editor, []); // end of document

  const sel = editor.selection;
  const safePoint =
    sel && Editor.hasPath(editor, sel.anchor.path) ? sel.anchor : fallback;

  // ensure selection exists and is mappable-ish
  Transforms.select(editor, safePoint);

  requestAnimationFrame(() => {
    try {
      ReactEditor.focus(editor);
    } catch (e) {
      // last-resort: just focus the DOM
      ReactEditor.toDOMNode(editor, editor).focus?.();
    }
  });
}
