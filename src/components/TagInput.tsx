import { cn } from "@udecode/cn";
import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import * as React from "react";

// todo(chris): Refactor this to accept a list of options / details dynanmically
const availableTags = ["in:", "tag:", "title:", "text:", "before:"];

interface TagInputProps {
  tokens: string[];
  onAdd: (token: string) => void;
  onRemove: (token: string) => void;
  /** Whether to show the dropdown on focus */
  dropdownEnabled?: boolean;
  /** placeholder text */
  placeholder?: string;
  /** When true, hide the borders / disable padding */
  ghost?: boolean;
}

const TagInput = observer((props: TagInputProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dropdown, _] = React.useState(observable({ open: false }));

  // Close the typeahead menu when clicking outside of the dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        dropdown.open = false;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={cn(
        "flex w-0 max-w-full flex-grow flex-col rounded-sm border bg-background text-xs drag-none",
        props.ghost && "border-none",
      )}
      ref={containerRef}
      onClick={() => inputRef.current?.focus()}
    >
      <div
        className={cn(
          "flex flex-grow items-center p-1.5",
          props.ghost && "p-0",
        )}
      >
        {props.tokens.map((token, idx) => (
          <Tag key={idx} token={token} remove={props.onRemove} />
        ))}
        <input
          ref={inputRef}
          className="w-0 min-w-8 flex-shrink flex-grow outline-none"
          type="text"
          placeholder={props.tokens.length ? "" : props.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && e.currentTarget.value === "") {
              // remove the last search token, if any
              if (props.tokens.length) {
                props.onRemove(props.tokens[props.tokens.length - 1]);
                setTimeout(() => inputRef.current?.focus(), 0); // Refocus the input
              }
            }

            if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
              props.onAdd(e.currentTarget.value.trim()); // Add the token
              e.currentTarget.value = ""; // Clear input

              // Unfocus and close the dropdown; after entering a tag, the user
              // likely wants to view the search results
              // e.currentTarget.blur();
              // dropdown.open = false;
            }

            // I'm angry, get me out of here! (close dropdown)
            if (e.key === "Escape") {
              e.currentTarget.value = "";
              e.currentTarget.blur();
              dropdown.open = false;
            }
          }}
          onFocus={() => (dropdown.open = true)}
          onInput={() => (dropdown.open = true)} // open menu anytime user types
        />
      </div>
      <div className="relative">
        {props.dropdownEnabled && dropdown.open && (
          <div className="absolute left-0 top-1 z-10 mt-2 w-full border bg-white shadow-md">
            {availableTags.slice(0, 5).map((tag, idx) => (
              <div
                key={idx}
                className="flex cursor-pointer justify-between p-2 hover:bg-gray-200"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  inputRef.current!.value = tag; // Set input to tag
                }}
              >
                <span>{tag}</span>
                <span className="text-gray-400">
                  {tag === "in:" && "Filter to specific journal"}
                  {tag === "tag:" && "Filter to specific tag"}
                  {tag === "title:" && "Filter by title"}
                  {tag === "text:" && "Search body text"}
                  {tag === "before:" &&
                    "Filter to notes before date (YYYY-MM-DD)"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default TagInput;

interface TagProps {
  token: string;
  remove: (token: string) => void;
}

const Tag = ({ token, remove }: TagProps) => {
  return (
    <span className="mr-2 flex flex-shrink items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border border-slate-800 bg-violet-200 px-1 py-0.5 text-xs text-slate-600">
      <span className="flex-shrink overflow-hidden text-ellipsis">{token}</span>
      <button
        className="text-grey-400 ml-1 flex-shrink-0"
        onClick={() => remove(token)}
      >
        ×
      </button>
    </span>
  );
};
