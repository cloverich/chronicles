import { useEditorRef } from "platejs/react";
import React from "react";
import { Editor } from "slate";

/**
 * Focus the editor when clicking on surrounding layout containers.
 */
export function useFocusEditor() {
  const editor = useEditorRef();

  return React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e.target !== e.currentTarget) return;

      try {
        const isFocused =
          typeof editor.api?.isFocused === "function"
            ? editor.api.isFocused()
            : false;

        if (isFocused) return;

        if (!editor.selection) {
          const end = Editor.end(editor as any, []);
          editor.tf.select(end);
        }

        editor.tf.focus();
      } catch (_error) {
        // If the editor can't resolve DOM nodes, attempt a safe focus fallback.
        try {
          editor.tf.focus({ edge: "endEditor" });
        } catch {
          // ignore
        }
      }
    },
    [editor],
  );
}
