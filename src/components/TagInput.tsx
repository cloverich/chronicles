import { cn } from "@udecode/cn";
import { cva } from "class-variance-authority";
import { observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

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
  /** A lazy hack to make the editors tags always start with a hash */
  prefixHash?: boolean;
  /** Optional keyboard shortcut to focus this input (e.g., "mod+f") */
  hotkey?: string;
}

/**
 * A multi-select input where values appear as tags
 */
const TagInput = observer((props: TagInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdown, _] = useState(observable({ open: false }));
  const hash = props.prefixHash ? "#" : null;

  // Optional keyboard shortcut to focus the input
  useHotkeys(
    props.hotkey || "",
    (e) => {
      e.preventDefault();
      inputRef.current?.focus();
    },
    {
      enabled: !!props.hotkey,
      enableOnFormTags: true,
    },
  );

  // Close the typeahead menu when clicking outside of the dropdown
  useEffect(() => {
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
          <CloseableTag key={idx} remove={() => props.onRemove(token)}>
            {hash}
            {token}
          </CloseableTag>
        ))}
        <input
          ref={inputRef}
          className="text-tag-foreground w-0 min-w-8 flex-shrink flex-grow bg-background outline-none"
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
          <div
            className={cn(
              "absolute left-0 top-1 z-10 mt-2 w-full",
              "bg-secondary/80 shadow-md backdrop-blur-sm",
              "border-b border-l border-r border-accent",
            )}
          >
            {availableTags.slice(0, 5).map((tag, idx) => (
              <div
                key={idx}
                className="flex cursor-pointer justify-between p-2 hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  if (inputRef.current) {
                    inputRef.current.value = tag; // Set input to tag
                  }
                }}
              >
                <span>{tag}</span>
                <span className="text-foreground">
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

TagInput.displayName = "TagInput";

export default TagInput;

const tagVariants = cva(
  cn(
    "mr-2 flex flex-shrink cursor-pointer items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border px-1 py-0.5 text-xs ",
  ),
  {
    variants: {
      variant: {
        default: "bg-tagg text-tagg-foreground",
        // todo: bg-accent just happens to be muted rn; in the future
        // likely need a bg-accent-muted or similar
        muted: "border-default bg-muted text-muted-foreground",
      },
      size: {
        default: "", //"h-10 px-4 py-2",
        xs: "py-0 px-0.5 text-xs",
        sm: "h-7 px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type PTag = React.PropsWithChildren<{
  className?: string;
  onClick?: () => void;
  size?: "default" | "xs" | "sm";
  variant?: "default" | "muted";
}>;

const Tag = ({ size, className, children, onClick, variant }: PTag) => {
  return (
    <span
      className={cn(tagVariants({ size, className, variant }))}
      onClick={onClick}
    >
      {children}
    </span>
  );
};

type ClickableTagProps = PTag & {
  onClick: () => void;
};

/**
 * Tag where user can click on any part of the tag to perform an action
 */
export const ClickableTag = ({ children, ...rest }: ClickableTagProps) => {
  return (
    <Tag {...rest}>
      <span className="flex-shrink overflow-hidden text-ellipsis">
        {children}
      </span>
    </Tag>
  );
};

type PClosableTag = PTag & {
  remove: () => void;
};

/**
 * Tag where user can click on an 'x' to remove the tag
 */
const CloseableTag = ({ remove, children, ...rest }: PClosableTag) => {
  return (
    <Tag {...rest}>
      <span className="flex-shrink overflow-hidden text-ellipsis">
        {children}
      </span>
      <button className="ml-1 flex-shrink-0" onClick={remove}>
        ×
      </button>
    </Tag>
  );
};
