import { $isListItemNode, $isListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import { $getSelection, $isRangeSelection, $isTextNode } from "lexical";
import React from "react";

/**
 * Converts `[ ] ` or `[x] ` typed inside a bullet list item into a checklist
 * item. MarkdownShortcutPlugin's CHECK_LIST transformer only fires when the
 * grandparent is Root — once `- ` triggers UNORDERED_LIST, the cursor is
 * inside a ListNode and CHECK_LIST can never fire. This plugin fills that gap
 * using registerUpdateListener (same approach as MarkdownShortcutPlugin): let
 * the space get inserted, then detect the pattern and convert.
 */
export function LexicalCheckListShortcutPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerUpdateListener(({ dirtyLeaves, editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

        const anchorNode = selection.anchor.getNode();
        if (!$isTextNode(anchorNode) || !dirtyLeaves.has(anchorNode.getKey())) {
          return;
        }

        const text = anchorNode.getTextContent();
        const offset = selection.anchor.offset;

        // Must be at the end of `[ ] ` or `[x] ` (space already inserted)
        if (offset !== text.length) return;
        const match = text.match(/^\[( |x)\] $/i);
        if (!match) return;

        const listItemNode = $findMatchingParent(anchorNode, $isListItemNode);
        if (!$isListItemNode(listItemNode)) return;

        const listNode = listItemNode.getParent();
        if (!$isListNode(listNode) || listNode.getListType() !== "bullet") {
          return;
        }

        const isChecked = match[1].toLowerCase() === "x";

        editor.update(() => {
          anchorNode.setTextContent("");
          listNode.setListType("check");
          listItemNode.setChecked(isChecked);
          listItemNode.selectStart();
        });
      });
    });
  }, [editor]);

  return null;
}
