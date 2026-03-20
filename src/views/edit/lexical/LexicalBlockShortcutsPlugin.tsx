import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $isListItemNode, $isListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalNode,
} from "lexical";
import React from "react";

function getCodeNodeAtCollapsedSelection() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  const codeNode = $findMatchingParent(anchorNode, $isCodeNode);
  if (!$isCodeNode(codeNode)) {
    return null;
  }

  return { anchorNode, codeNode, selection };
}

function isSelectionAtCodeBlockEnd(
  codeNode: ReturnType<typeof $createCodeNode>,
  anchorNode: LexicalNode,
  anchorOffset: number,
): boolean {
  if ($isCodeNode(anchorNode)) {
    return anchorOffset === anchorNode.getChildrenSize();
  }

  const parent = anchorNode.getParent();
  return (
    parent !== null &&
    parent.is(codeNode) &&
    anchorNode.getNextSibling() === null
  );
}

function exitSpecialBlockAtSelection(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const anchorNode = selection.anchor.getNode();
  const listItemNode = $findMatchingParent(anchorNode, $isListItemNode);
  if ($isListItemNode(listItemNode)) {
    const maybeListNode = listItemNode.getParent();
    if ($isListNode(maybeListNode)) {
      const paragraph = $createParagraphNode();
      maybeListNode.insertAfter(paragraph);
      paragraph.select();
      return true;
    }
  }

  const quoteNode = $findMatchingParent(anchorNode, $isQuoteNode);
  if ($isQuoteNode(quoteNode)) {
    const paragraph = $createParagraphNode();
    quoteNode.insertAfter(paragraph);
    paragraph.select();
    return true;
  }

  const codeNode = $findMatchingParent(anchorNode, $isCodeNode);
  if ($isCodeNode(codeNode)) {
    const paragraph = $createParagraphNode();
    codeNode.insertAfter(paragraph);
    paragraph.select();
    return true;
  }

  return false;
}

export function LexicalBlockShortcutsPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const pendingCodeExitRef = React.useRef<{
    codeKey: string;
    timestamp: number;
  } | null>(null);

  React.useEffect(() => {
    const removeKeyDownListener = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!event) {
          return false;
        }

        const isModifierPressed = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();

        if (isModifierPressed && event.altKey && key === "8") {
          event.preventDefault();
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return;
            }

            const anchorNode = selection.anchor.getNode();
            const inCode = $findMatchingParent(anchorNode, $isCodeNode);
            if ($isCodeNode(inCode)) {
              $setBlocksType(selection, () => $createParagraphNode());
              return;
            }

            $setBlocksType(selection, () => $createCodeNode());
          });
          return true;
        }

        if (
          isModifierPressed &&
          !event.altKey &&
          !event.shiftKey &&
          key === "enter"
        ) {
          let didExit = false;
          editor.update(() => {
            didExit = exitSpecialBlockAtSelection();
          });

          if (didExit) {
            event.preventDefault();
            pendingCodeExitRef.current = null;
            return true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const removeEnterListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        let didExit = false;
        editor.update(() => {
          const context = getCodeNodeAtCollapsedSelection();
          if (!context) {
            pendingCodeExitRef.current = null;
            return;
          }

          const atCodeEnd = isSelectionAtCodeBlockEnd(
            context.codeNode,
            context.anchorNode,
            context.selection.anchor.offset,
          );
          if (!atCodeEnd) {
            pendingCodeExitRef.current = null;
            return;
          }

          const now = Date.now();
          const pending = pendingCodeExitRef.current;
          if (
            pending &&
            pending.codeKey === context.codeNode.getKey() &&
            now - pending.timestamp < 1500
          ) {
            const paragraph = $createParagraphNode();
            context.codeNode.insertAfter(paragraph);
            paragraph.select();
            pendingCodeExitRef.current = null;
            didExit = true;
            return;
          }

          pendingCodeExitRef.current = {
            codeKey: context.codeNode.getKey(),
            timestamp: now,
          };
        });

        if (didExit) {
          event?.preventDefault();
        }

        return didExit;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      removeKeyDownListener();
      removeEnterListener();
    };
  }, [editor]);

  return null;
}
