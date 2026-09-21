import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot } from "lexical";
import { useEffect } from "react";
import {
  $isChroniclesImageNode,
  ChroniclesImageNode,
} from "./ChroniclesImageNode";
import { $isMarkdownTableNode, MarkdownTableNode } from "./MarkdownTableNode";

function $ensureFollowingParagraph(
  image: ChroniclesImageNode | MarkdownTableNode,
): void {
  if (image.getNextSibling() !== null) return;
  const paragraph = $createParagraphNode();
  image.insertAfter(paragraph);
  paragraph.selectStart();
}

/** Keep a writable block after a terminal decorator such as an image. */
export function DecoratorBoundaryPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeTransform = editor.registerNodeTransform(
      ChroniclesImageNode,
      $ensureFollowingParagraph,
    );
    const removeTableTransform = editor.registerNodeTransform(
      MarkdownTableNode,
      $ensureFollowingParagraph,
    );

    // Imported markdown was created before plugin effects were registered.
    editor.update(() => {
      const last = $getRoot().getLastChild();
      if ($isChroniclesImageNode(last) || $isMarkdownTableNode(last))
        $ensureFollowingParagraph(last);
    });

    return () => {
      removeTransform();
      removeTableTransform();
    };
  }, [editor]);

  return null;
}
