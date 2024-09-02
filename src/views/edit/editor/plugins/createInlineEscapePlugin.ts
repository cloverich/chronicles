import { createPluginFactory } from "@udecode/plate-core";

// These are all effectively overrides of Slate Editor.blah methods, sometimes re-named,
// usually handling Plate types and doing inline null checking
import {
  getAboveNode,
  getPointAfter,
  isEndPoint,
  isInline,
  setSelection,
} from "@udecode/plate-common";
import { Range } from "slate";

const KEY_INLINE_ESCAPE = "inline-escape";

/**
 * Escape an inline element (ex: Link editing) when the cursor is at the end.
 *
 * This is required to escape from link or note link editing when at the end of the "inline" element.
 * It does mean if you want to edit the end of text, or add spaces, that you have to move the cursor
 * inisde the element, edit as needed, then delete the end, but this is common in many editors.
 *
 * It may make sense to do something more sophisticated eventually, see the below for context:
 *
 * Built in to Slate: https://github.com/ianstormtaylor/slate/pull/3260
 * Removed from Slate (reverts ^): https://github.com/ianstormtaylor/slate/pull/4578
 * Advanced example: https://github.com/ianstormtaylor/slate/pull/4615
 * (Active issue) strongly related to ^: https://github.com/ianstormtaylor/slate/issues/4704
 */
export const createInlineEscapePlugin = createPluginFactory({
  key: KEY_INLINE_ESCAPE,
  isVoid: true,
  withOverrides: (editor) => {
    const { insertText } = editor;

    editor.insertText = (text) => {
      const { selection } = editor;

      if (selection) {
        const { anchor } = selection;

        // Check if the selection is collapsed and at the end of an inline
        if (Range.isCollapsed(selection)) {
          const inline = getAboveNode(editor, {
            match: (n) => isInline(editor, n),
          });

          if (inline) {
            const [, inlinePath] = inline;

            // If the cursor is at the end of the inline, move it outside
            if (isEndPoint(editor, anchor, inlinePath)) {
              const point = getPointAfter(editor, inlinePath);
              if (point) {
                setSelection(editor, { anchor: point, focus: point });
              }
            }
          }
        }
      }

      // Call the original insertText method
      insertText(text);
    };

    return editor;
  },
});
