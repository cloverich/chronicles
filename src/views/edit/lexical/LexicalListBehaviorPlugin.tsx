import { $isCodeNode } from "@lexical/code";
import { $getListDepth, $isListItemNode, $isListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INDENT_CONTENT_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from "lexical";
import React from "react";

export function LexicalListBehaviorPlugin(): null {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }

        const anchorNode = selection.anchor.getNode();
        const inCode = $findMatchingParent(anchorNode, $isCodeNode);
        if ($isCodeNode(inCode)) {
          return false;
        }

        const listItemNode = $findMatchingParent(anchorNode, $isListItemNode);
        if (!$isListItemNode(listItemNode)) {
          return false;
        }

        if (!event.shiftKey) {
          const parentListNode = listItemNode.getParent();
          if (
            $isListNode(parentListNode) &&
            $getListDepth(parentListNode) >= 3
          ) {
            event.preventDefault();
            return true;
          }
        }

        event.preventDefault();
        editor.dispatchCommand(
          event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
          undefined,
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
