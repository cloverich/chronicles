import type { AutoformatBlockRule } from "@udecode/plate-autoformat";

import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_CODE_LINE,
} from "@udecode/plate-code-block";
import {
  type PlateEditor,
  getParentNode,
  isElement,
  isType,
} from "@udecode/plate-common";
import { toggleList, unwrapList } from "@udecode/plate-list";

// NOTE: Plate documentation provides examples of configuring autoformat rules; they reference
// a few functions like "preFormat" that are not in the autoformat plugin package, but instead
// a part of the demo / playground code. Yet oddly, there are tests _for these functions_ within
// the @udecode/plate-autoformat package; so perhaps these will be incorporated into that package
// in a future version, and these can be deleted. Will try to avoid changing them for now.

export const preFormat: AutoformatBlockRule["preFormat"] = (editor) =>
  unwrapList(editor);

export const format = (editor: PlateEditor, customFormatting: any) => {
  if (editor.selection) {
    const parentEntry = getParentNode(editor, editor.selection);

    if (!parentEntry) return;

    const [node] = parentEntry;

    if (
      isElement(node) &&
      !isType(editor, node, ELEMENT_CODE_BLOCK) &&
      !isType(editor, node, ELEMENT_CODE_LINE)
    ) {
      customFormatting();
    }
  }
};

export const formatList = (editor: PlateEditor, elementType: string) => {
  format(editor, () =>
    toggleList(editor, {
      type: elementType,
    }),
  );
};

export const formatText = (editor: PlateEditor, text: string) => {
  format(editor, () => editor.insertText(text));
};
