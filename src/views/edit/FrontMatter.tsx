import { observer } from "mobx-react-lite";
import React, { useMemo } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import * as D from "../../components/DropdownMenu";
import * as Popover from "../../components/Popover";
import TagInput from "../../components/tag-input/TagInput";
import { useAutosizeTextarea } from "../../hooks/useAutosizeTextarea";
import { JournalResponse } from "../../hooks/useClient";
import { usePreferences } from "../../hooks/usePreferences";
import { useTags } from "../../hooks/useTags";
import { TagTokenParser } from "../documents/search/parsers/tag";
interface DocumentProps {
  createdAt: string;
  title?: string;
  journal: string;
  tags: string[];
  save(type: "frontmatter", content: undefined): unknown;
}

const rdp = getDefaultClassNames();

const FrontMatter = observer(
  ({
    document,
    journals,
  }: {
    document: DocumentProps;
    journals: JournalResponse[];
  }) => {
    const journalSelectorOpenState = D.useOpenState();
    const datePickerOpenState = D.useOpenState();
    const { tags: allTagsRaw } = useTags();
    const preferences = usePreferences();

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
    const titleRef = useAutosizeTextarea(document.title || "", [
      preferences.fontSizes?.title,
    ]);

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
            <span className="border-primary cursor-pointer border-b">
              {getName(document.journal)}
            </span>
          </D.DropdownMenuTrigger>
          <D.DropdownMenuContent align="start">
            {makeOptions(close)}
          </D.DropdownMenuContent>
        </D.DropdownMenu>
      );
    }

    function onDayPick(day: Date | undefined) {
      if (!day) return;
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
            <span className="border-primary cursor-pointer border-b">
              {document.createdAt.slice(0, 10)}
            </span>
          </Popover.PopoverTrigger>
          <Popover.PopoverContent align="start">
            <div className="font-mono text-xs">
              <DayPicker
                selected={new Date(document.createdAt)}
                defaultMonth={new Date(document.createdAt)}
                captionLayout="dropdown"
                onSelect={onDayPick}
                mode="single"
                style={
                  {
                    "--rdp-accent-color": "var(--accent)",
                    "--rdp-weekday-text-transform": "uppercase",
                  } as React.CSSProperties
                }
                classNames={{
                  ...rdp,
                  dropdown_root: `${rdp.dropdown_root} text-sm`,
                  month_caption: `${rdp.month_caption} uppercase text-xs px-2`,
                  weekdays: `${rdp.weekday} font-mono uppercase`,
                  nav: `${rdp.nav} text-accent-foreground`,
                  root: `${rdp.root} bg-popover text-popover-foreground`,
                  button_previous: `${rdp.button_previous} hover:bg-accent hover:text-accent-foreground`,
                  button_next: `${rdp.button_next} hover:bg-accent hover:text-accent-foreground`,
                  day: `${rdp.day} hover:text-accent-foreground`,
                  selected: `${rdp.selected} text-accent font-semibold`,
                  today: `${rdp.today} font-semibold`,
                  outside: `${rdp.outside} text-muted-foreground opacity-50`,
                  disabled: `${rdp.disabled} text-muted-foreground opacity-50`,
                }}
              />
            </div>
          </Popover.PopoverContent>
        </Popover.Popover>
      );
    }

    return (
      <div className="w-full max-w-[var(--max-w-frontmatter)]">
        {/* Document title */}
        <div>
          <textarea
            name="title"
            ref={titleRef}
            className="bg-background text-foreground w-full resize-none border-none font-medium focus:outline-hidden"
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "var(--font-size-title)",
              lineHeight: 1.15,
              minHeight: "calc(var(--font-size-title) * 1.15)",
            }}
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
      </div>
    );
  },
);

export default FrontMatter;
