import React, { useState } from "react";

import { cn, withRef } from "@udecode/cn";
import { PlateElement, PlateEditor } from "@udecode/plate-common";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from "../../components/InlineCombobox";
import { NOTE_LINK } from "./createNoteLinkDropdownPlugin";
import { ELEMENT_NOTE_LINK, INoteLinkElement } from "./NoteLinkElement";

import {
  TMentionItemBase,
  MentionOnSelectItem,
  MentionPlugin,
  TMentionElement,
} from "@udecode/plate";

import {
  getPlugin,
  insertNodes,
  moveSelection,
  getBlockAbove,
  isEndPoint,
  insertText,
} from "@udecode/plate-common";
import { SearchItem, SearchStore } from "../../../../documents/SearchStore";

type Option = Pick<INoteLinkElement, "noteId" | "title" | "journalName">;

/**
 * When selecting an item, insert a "note link" to the selected note.
 */
const onSelect = (editor: PlateEditor, item: Option) => {
  // Get the parent createNoteRefPlugin
  const {
    options: { insertSpaceAfterMention },
    type,
  } = getPlugin<MentionPlugin>(editor as any, NOTE_LINK);

  // Inlined (and de-paramaterized) from createMentionNode
  const props = {
    title: item.title,
    noteId: item.noteId,
    journalName: item.journalName,
  };

  insertNodes<INoteLinkElement>(editor, {
    children: [{ text: item.title }],
    type: ELEMENT_NOTE_LINK,
    ...props,
  } as INoteLinkElement);

  // move the selection after the element
  moveSelection(editor, { unit: "offset" });

  const pathAbove = getBlockAbove(editor)?.[1];

  const isBlockEnd =
    editor.selection &&
    pathAbove &&
    isEndPoint(editor, editor.selection.anchor, pathAbove);

  if (isBlockEnd && insertSpaceAfterMention) {
    insertText(editor, " ");
  }
};

// Convert document response objects into options for the dropdown
function toOptions(
  docs: SearchItem[],
): Pick<INoteLinkElement, "title" | "journalName" | "noteId">[] {
  return docs.slice(0, 10).map((d) => ({
    noteId: d.id,
    title: d.title || d.id,
    journalName: d.journalId,
  }));
}

/**
 * A dropdown element, triggered by the "@" character, that searches notes.
 * On select, insert a link ("note link") to the note.
 */
export const NoteLinkDropdownElement = withRef<typeof PlateElement>(
  ({ className, ...props }, ref) => {
    const { children, editor, element, store } = props as typeof props & {
      // todo: Use a dedicated store, or a (type) sub-set of the SearchStore
      store: SearchStore;
    };

    const [search, setSearch] = useState("");

    React.useEffect(() => {
      // todo: leading debounce; build into the store itself
      store.setSearch([`title:${search}`]);
    }, [search]);

    return (
      <PlateElement
        as="span"
        data-slate-value={element.value}
        ref={ref}
        {...props}
      >
        <InlineCombobox
          element={element}
          setValue={setSearch}
          showTrigger={false}
          trigger="@"
          value={search}
        >
          <span
            className={cn(
              "inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2",
              className,
            )}
          >
            <InlineComboboxInput />
          </span>

          <InlineComboboxContent className="my-1.5">
            <InlineComboboxEmpty>No results found</InlineComboboxEmpty>

            {toOptions(store.docs).map((item) => (
              <InlineComboboxItem
                key={item.noteId}
                onClick={() => onSelect(editor, item)}
                value={item.title}
              >
                {item.title}
              </InlineComboboxItem>
            ))}
          </InlineComboboxContent>
        </InlineCombobox>

        {children}
      </PlateElement>
    );
  },
);
