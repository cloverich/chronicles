import React, { useState } from "react";

import { cn, withRef } from "@udecode/cn";
import { PlateEditor, PlateElement } from "@udecode/plate/react";
import { Editor, Transforms } from "slate";

import { SearchItem, SearchStore } from "../../../../documents/SearchStore";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from "../../components/InlineCombobox";
import { ELEMENT_NOTE_LINK, INoteLinkElement } from "./NoteLinkElement";
import { NOTE_LINK } from "./createNoteLinkDropdownPlugin";

type Option = Pick<INoteLinkElement, "noteId" | "title" | "journalName">;

/**
 * When selecting an item, insert a "note link" to the selected note.
 */
const onSelect = (editor: PlateEditor, item: Option) => {
  // Build the note link element
  const props = {
    title: item.title,
    noteId: item.noteId,
    journalName: item.journalName,
  };

  Transforms.insertNodes(
    editor as any,
    {
      children: [{ text: item.title }],
      type: ELEMENT_NOTE_LINK,
      ...props,
    } as INoteLinkElement,
  );

  // Move the selection after the element
  Transforms.move(editor as any, { unit: "offset" });

  // Insert space after mention if at end of block
  const blockEntry = Editor.above(editor as any, {
    match: (n: any) => Editor.isBlock(editor as any, n),
  });
  const pathAbove = blockEntry?.[1];

  const isBlockEnd =
    editor.selection &&
    pathAbove &&
    Editor.isEnd(editor as any, editor.selection.anchor, pathAbove);

  if (isBlockEnd) {
    Transforms.insertText(editor as any, " ");
  }
};

// Convert document response objects into options for the dropdown
function toOptions(
  docs: SearchItem[],
): Pick<INoteLinkElement, "title" | "journalName" | "noteId">[] {
  return docs.slice(0, 10).map((d) => ({
    noteId: d.id,
    title: d.title || d.id, // for untitled notes
    journalName: d.journal,
  }));
}

/**
 * A dropdown element, triggered by the "@" character, that searches notes.
 * On select, insert a link ("note link") to the note.
 */
export const NoteLinkDropdownElement = withRef<typeof PlateElement>(
  ({ className, ...props }, ref) => {
    const { children, editor, element } = props;

    // Get the store from plugin options
    const store = editor.getOptions({ key: NOTE_LINK }).store as SearchStore;

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
