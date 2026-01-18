import { observer } from "mobx-react-lite";
import React, { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import * as D from "../../components/DropdownMenu";
import * as Popover from "../../components/Popover";
import TagInput from "../../components/tag-input/TagInput";
import { useAutosizeTextarea } from "../../hooks/useAutosizeTextarea";
import { JournalResponse } from "../../hooks/useClient";
import { useTags } from "../../hooks/useTags";
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
    const { tags: allTagsRaw } = useTags();

    // todo: cleanup
    const allTags = useMemo(() => {
      return allTagsRaw.map((t) => ({
        value: t,
      }));
    }, [allTagsRaw]);

    function onAddTag(token: string) {
      let tag = new TagTokenParser().parse(token)?.value;
      if (!tag) return;

      if (!document.tags.includes(tag)) {
        // todo: this is probably double saving!
        document.tags.push(tag);
        document.save("frontmatter", undefined);
      }
    }

    function onRemoveTag(tag: string) {
      document.tags = document.tags.filter((t) => t !== tag);
      document.save("frontmatter", undefined);
    }

    // Auto-resize textarea to fit content
    const titleRef = useAutosizeTextarea(document.title || "");

    // Autofocus on mount
    React.useEffect(() => {
      const textarea = titleRef.current;
      if (textarea) {
        // After experimenting, unsure why the delay is helpful.
        // https://blog.maisie.ink/react-ref-autofocus/
        setTimeout(() => textarea.focus(), 200);
        textarea.focus();
      }
    }, [titleRef]);

    // todo: this is no longer needed (since re-wroking journal id to its name)
    function getName(journalName?: string) {
      const journal = journals?.find((j) => j.name === journalName);
      return journal ? journal.name : "Unknown journal";
    }

    function makeOptions(close: any) {
      return journals.map((j: any) => {
        return (
          <D.DropdownMenuItem
            key={j.name}
            onSelect={(e) => {
              document.journal = j.name;
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
            <span className="border-accent cursor-pointer border-b">
              {getName(document.journal)}
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
            <span className="border-accent cursor-pointer border-b">
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
          <textarea
            name="title"
            ref={titleRef}
            className="bg-background font-heading text-foreground min-h-6 w-full resize-none overflow-hidden border-none text-2xl font-medium focus:outline-hidden"
            onChange={(e: any) => {
              document.title = e.target.value;
            }}
            value={document.title || ""}
            placeholder="Untitled document"
            rows={1}
            maxLength={200}
          />
        </div>

        {/* Date / Journal dropdown */}
        <div className="mb-4 flex justify-start pl-0.5 font-mono text-xs">
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
            prefixHash={true}
            suggestions={allTags}
            openOnEmptyFocus={false}
          />
        </div>
      </>
    );
  },
);

export default FrontMatter;
