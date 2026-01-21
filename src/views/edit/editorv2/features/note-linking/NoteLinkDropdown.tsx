import React, { useState } from "react";

import { PlateElement, type PlateElementProps } from "platejs/react";
import { Transforms } from "slate";

import { cn } from "../../../../../lib/utils";
import { SearchItem, SearchStore } from "../../../../documents/SearchStore";
import { useFocusEditor } from "../../useFocusEditor";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxInput,
  InlineComboboxItem,
} from "../combobox/InlineCombobox";
import { ELEMENT_NOTE_LINK, INoteLinkElement } from "./NoteLinkElement";
import { NOTE_LINK } from "./createNoteLinkDropdownPlugin";

type Option = Pick<INoteLinkElement, "noteId" | "title" | "journalName">;

/**
 * When selecting an item, insert a "note link" to the selected note.
 * Note: This is called after removeInput() has already removed the dropdown
 * element, so we insert at the current selection.
 */
const insertNoteLink = (
  editor: any,
  item: Option,
  focusEditor: (e?: React.MouseEvent<HTMLDivElement, MouseEvent>) => void,
) => {
  // Build the note link element
  const noteLink: INoteLinkElement = {
    type: ELEMENT_NOTE_LINK,
    title: item.title,
    noteId: item.noteId,
    journalName: item.journalName,
    children: [{ text: item.title }],
  };

  // Insert the note link at current selection (dropdown was already removed by removeInput)
  Transforms.insertNodes(editor as any, noteLink);

  // Move cursor after the note link
  Transforms.move(editor as any, { unit: "offset", distance: 1 });

  // Insert a space after the note link so cursor has a text node to land in
  Transforms.insertText(editor as any, " ");

  focusEditor();
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
export const NoteLinkDropdownElement = React.forwardRef<
  React.ElementRef<typeof PlateElement>,
  PlateElementProps
>(({ className, ...props }, ref) => {
  const { children, editor, element } = props as PlateElementProps;
  const focusEditor = useFocusEditor();

  // Get the store from plugin options
  const options =
    (editor as any).getOptions?.({ key: NOTE_LINK }) ??
    (editor as any).getOptions?.(NOTE_LINK) ??
    {};
  const store = (options as any).store as SearchStore;

  if (!store) {
    return (
      <PlateElement as="span" ref={ref} {...props}>
        {children}
      </PlateElement>
    );
  }

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
            "bg-muted ring-ring inline-block rounded-md px-1.5 py-0.5 align-baseline text-sm focus-within:ring-2",
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
              onClick={() => insertNoteLink(editor, item, focusEditor)}
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
});

NoteLinkDropdownElement.displayName = "NoteLinkDropdownElement";
