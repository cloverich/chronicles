import { Popover, Menu, Position, TagInput } from "evergreen-ui";
import React from "react";
import { DayPicker } from "react-day-picker";
import { JournalResponse } from "../../preload/client/journals";
import { TagTokenParser } from "../documents/search/parsers/tag";
import { EditableDocument } from "./EditableDocument";
import { observer } from "mobx-react-lite";

const FrontMatter = observer(
  ({
    document,
    journals,
  }: {
    document: EditableDocument;
    journals: JournalResponse[];
  }) => {
    function onAddTag(tokens: string[]) {
      if (tokens.length > 1) {
        // https://evergreen.segment.com/components/tag-input
        // Documents say this is single value, Type says array
        // Testing says array but with only one value... unsure how multiple
        // values end up in the array.
        console.warn(
          "TagInput.onAdd called with > 1 token? ",
          tokens,
          "ignoring extra tokens",
        );
      }

      let tag = new TagTokenParser().parse(tokens[0])?.value;
      if (!tag) return;

      if (!document.tags.includes(tag)) {
        document.tags.push(tag);
        document.save();
      }
    }

    function onRemoveTag(tag: string | React.ReactNode, idx: number) {
      if (typeof tag !== "string") return;
      document.tags = document.tags.filter((t) => t !== tag);
      document.save();
    }

    // Autofocus the heading input
    const onInputRendered = React.useCallback(
      (inputElement: HTMLInputElement) => {
        if (inputElement) {
          // After experimenting, unsure why the delay is helpful.
          // https://blog.maisie.ink/react-ref-autofocus/
          setTimeout(() => inputElement.focus(), 200);
          inputElement.focus();
        }
      },
      [],
    );

    // todo: move this to view model
    function getName(journalId?: string) {
      const journal = journals?.find((j) => j.id === journalId);
      return journal ? journal.name : "Unknown journal";
    }

    function makeOptions(close: any) {
      return journals.map((j: any) => {
        return (
          <Menu.Item
            key={j.id}
            onSelect={(e) => {
              document.journalId = j.id;
              close();
            }}
          >
            {j.name}
          </Menu.Item>
        );
      });
    }

    function journalPicker() {
      return (
        <Popover
          position={Position.BOTTOM}
          content={({ close }) => (
            <div className="max-h-24rem overflow-auto">
              <Menu>
                <Menu.Group>{makeOptions(close)}</Menu.Group>
              </Menu>
            </div>
          )}
        >
          <span className="cursor-pointer border-b border-slate-500">
            {getName(document.journalId)}
          </span>
        </Popover>
      );
    }

    function onDayPick(day: Date, callback: () => void) {
      document.createdAt = day.toISOString();
      callback();
    }

    // tests: when changing date, documents date is highlighted
    // when changing date, currently selected date's month is the active one
    // document auto-saves when changing date
    function datePicker() {
      return (
        <Popover
          position={Position.BOTTOM}
          content={({ close }) => (
            <div className="max-h-24rem overflow-auto">
              <DayPicker
                selected={new Date(document.createdAt)}
                defaultMonth={new Date(document.createdAt)}
                onDayClick={(day) => onDayPick(day, close)}
                mode="single"
              />
            </div>
          )}
        >
          <span className="cursor-pointer border-b border-slate-500">
            {document.createdAt.slice(0, 10)}
          </span>
        </Popover>
      );
    }

    return (
      <>
        {/* Document title */}
        <div>
          <input
            type="text"
            name="title"
            ref={onInputRendered}
            className="font-heading font-medium text-2xl w-full border-none focus:outline-none"
            onChange={(e: any) => (document.title = e.target.value)}
            value={document.title || ""} // OR '' prevents react complaining about uncontrolled component
            placeholder="Untitled document"
          />
        </div>

        {/* Date / Journal dropdown */}
        <div className="flex justify-start pl-0.5 text-xs mb-4">
          {datePicker()}
          &nbsp;in&nbsp;
          {journalPicker()}
        </div>

        {/* Tags */}
        <div className="flex justify-start pl-0.5 text-sm -mt-2 mb-4">
          <TagInput
            flexGrow={1}
            inputProps={{ placeholder: "Document tags" }}
            values={document.tags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
          />
        </div>
      </>
    );
  },
);

export default FrontMatter;
