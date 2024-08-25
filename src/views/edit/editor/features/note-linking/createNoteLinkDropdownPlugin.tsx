import { createPluginFactory } from "@udecode/plate-core";
import {
  type PlateEditor,
  type TElement,
  getEditorString,
  getPointBefore,
  getRange,
  getPluginOptions,
} from "@udecode/plate-common";

export const NOTE_LINK = "noteLinkingPlugin";

interface NoteLinkPlugin {
  triggerPreviousCharPattern?: RegExp;
  triggerQuery?: (editor: PlateEditor) => boolean;
}

const TRIGGER = "@";
const TRIGGER_PRIOR_PATTERN = /^\s?$/; // whitespace or beginning of line

// Previously, trigger was an option, and could be a regex, string, or array of strings.
const matchesTrigger = (text: string) => {
  return text === TRIGGER;
};

/**
 * Insert a note linking dropdown when "@" is typed.
 *
 * This plugin handles detecting the "@" character, inserting the dropdown,
 * and injecting the search store into the dropdown.
 *
 * Adapated from MentionInput plugin and TriggerCombobox
 * https://github.com/udecode/plate/blob/main/packages/combobox/src/withTriggerCombobox.ts
 */
export const createNoteLinkDropdownPlugin = createPluginFactory<NoteLinkPlugin>(
  {
    key: NOTE_LINK,

    isVoid: true,
    isInline: true,
    // If false, when typing `@` neither the `@` symbol nor the dropdown will appear.
    isElement: true,

    // Can't use props directly, because we won't have a store reference
    // props: ...
    // Instead we can do this:
    then: (editor, { options }: any) => {
      // Docs suggest this, but it was not working :shrug:
      // const options = getPluginOptions<any>(editor, NOTE_LINK);

      // Store is injected to this plugin in <PlateContainer>;
      // Forward to dropdown by injecting into options here.
      // Maybe using context would be better?
      return {
        props: {
          store: options.store,
        },
      };
    },

    withOverrides: (editor) => {
      const { insertText } = editor;

      editor.insertText = (text) => {
        if (!editor.selection || !matchesTrigger(text)) {
          return insertText(text);
        }

        // Only insert the dropdown if the previous character is a space or beginning of line
        const previousChar = getEditorString(
          editor,
          getRange(
            editor,
            editor.selection,
            getPointBefore(editor, editor.selection),
          ),
        );

        if (TRIGGER_PRIOR_PATTERN?.test(previousChar)) {
          return editor.insertNode({
            type: NOTE_LINK,
            trigger: text,
            children: [{ text: "" }],
          });
        }

        return insertText(text);
      };

      return editor;
    },
  },
);
