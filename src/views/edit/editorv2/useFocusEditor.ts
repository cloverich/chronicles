import { useEditorRef } from "platejs/react";
import React from "react";
import { Editor } from "slate";

/**
 * Focus the editor when clicking on surrounding layout containers.
 */
export function useFocusEditor(
  className: string = "[data-slate-editor='true']",
) {
  const editor = useEditorRef();

  return React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e.target !== e.currentTarget) return;

      e.preventDefault();

      const end = Editor.end(editor as any, []);

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
