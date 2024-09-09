import { observer } from "mobx-react-lite";
import React from "react";
import { DayPicker } from "react-day-picker";
import * as D from "../../components/DropdownMenu";
import * as Popover from "../../components/Popover";
import TagInput from "../../components/TagInput";
import { JournalResponse } from "../../preload/client/journals";
import { TagTokenParser } from "../documents/search/parsers/tag";
import { EditableDocument } from "./EditableDocument";

const FrontMatter = observer(
  ({
    document,
    journals,
  }: {
    document: EditableDocument;
    journals: JournalResponse[];
  }) => {
    const journalSelectorOpenState = D.useOpenState();
    const datePickerOpenState = D.useOpenState();

    function onAddTag(token: string) {
      let tag = new TagTokenParser().parse(token)?.value;
      if (!tag) return;

      if (!document.tags.includes(tag)) {
        document.tags.push(tag);
        document.save();
      }
    }

    function onRemoveTag(tag: string) {
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
          <D.DropdownMenuItem
            key={j.id}
            onSelect={(e) => {
              document.journalId = j.id;
            }}
          >
            {j.name}
          </D.DropdownMenuItem>
        );
      });
    }

    function journalPicker() {
      return (
        <D.DropdownMenu modal={false} {...journalSelectorOpenState}>
          <D.DropdownMenuTrigger asChild>
            <span className="cursor-pointer border-b border-slate-500">
              {getName(document.journalId)}
            </span>
          </D.DropdownMenuTrigger>
          <D.DropdownMenuContent align="start">
            {makeOptions(close)}
          </D.DropdownMenuContent>
        </D.DropdownMenu>
      );
    }

    function onDayPick(day: Date) {
      document.createdAt = day.toISOString();
      datePickerOpenState.onOpenChange(false);
    }

    // tests: when changing date, documents date is highlighted
    // when changing date, currently selected date's month is the active one
    // document auto-saves when changing date
    function datePicker() {
      return (
        <Popover.Popover {...datePickerOpenState}>
          <Popover.PopoverTrigger>
            <span className="cursor-pointer border-b border-slate-500">
              {document.createdAt.slice(0, 10)}
            </span>
          </Popover.PopoverTrigger>
          <Popover.PopoverContent align="start">
            <div className="max-h-24rem overflow-auto">
              <DayPicker
                selected={new Date(document.createdAt)}
                defaultMonth={new Date(document.createdAt)}
                onDayClick={(day) => onDayPick(day)}
                mode="single"
              />
            </div>
          </Popover.PopoverContent>
        </Popover.Popover>
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
            className="w-full border-none font-heading text-2xl font-medium focus:outline-none"
            onChange={(e: any) => (document.title = e.target.value)}
            value={document.title || ""} // OR '' prevents react complaining about uncontrolled component
            placeholder="Untitled document"
          />
        </div>

        {/* Date / Journal dropdown */}
        <div className="mb-4 flex justify-start pl-0.5 text-xs">
          {datePicker()}
          &nbsp;in&nbsp;
          {journalPicker()}
        </div>

        {/* Tags */}
        <div className="-mt-2 mb-4 flex justify-start pl-0.5 text-sm">
          <TagInput
            tokens={document.tags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
            placeholder="Add tags"
            ghost={true}
          />
        </div>
      </>
    );
  },
);

export default FrontMatter;
