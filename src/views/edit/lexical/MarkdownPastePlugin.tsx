import { $generateNodesFromMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodes, COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";
import { chroniclesLexicalTransformers } from "./lexicalMarkdown";

const BLOCK_MARKER = /^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|\|.*\||```|~~~)/m;

export function MarkdownPastePlugin(): null {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!("clipboardData" in event)) return false;
          const data = event.clipboardData;
          if (!data || data.files?.length || data.getData("text/html"))
            return false;
          const plain = data.getData("text/plain");
          if (!BLOCK_MARKER.test(plain)) return false;
          event.preventDefault();
          $insertNodes(
            $generateNodesFromMarkdownString(
              plain,
              chroniclesLexicalTransformers,
            ),
          );
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );
  return null;
}
