import React from "react";
import { useEditorRef } from "platejs/react";
import { ReactEditor } from "slate-react";

/**
 * Focus the editor when clicking on surrounding layout containers.
 */
export function useFocusEditor() {
  const editor = useEditorRef();

  return React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e.target === e.currentTarget && !ReactEditor.isFocused(editor as any)) {
        ReactEditor.focus(editor as any);
      }
    },
    [editor],
  );
}
