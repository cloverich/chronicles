import { cn } from "@udecode/cn";
import { cva } from "class-variance-authority";
import { runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { TagStore } from "./TagStore";

interface TagInputProps {
  tokens: string[];
  onAdd: (token: string) => void;
  onRemove: (token: string) => void;
  /** Whether to show the dropdown on focus, when empty */
  openOnEmptyFocus?: boolean;
  /** Whether to infer selection is fill+search */
  searchOnSelect?: boolean;
  /** placeholder text */
  placeholder?: string;
  /** When true, hide the borders / disable padding */
  ghost?: boolean;
  /** A lazy hack to make the editors tags always start with a hash */
  prefixHash?: boolean;
  /** Optional keyboard shortcut to focus this input (e.g., "mod+f") */
  hotkey?: string;
  /** List of suggestions for autocomplete */
  suggestions: Option[];
}

interface Option {
  value: string;
  label?: string;
}

/**
 * A multi-select input where values appear as tags
 *
 * todo: consolidate with Plate editor inline combobox
 */
const TagInput = observer((props: TagInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hash = props.prefixHash ? "#" : null;
  const store = useMemo(
    () => new TagStore(props.suggestions, props.openOnEmptyFocus, props.tokens),
    [],
  );

  // tags come in async
  useEffect(() => {
    runInAction(() => {
      store.options = props.suggestions!;
    });
  }, [props.suggestions]);

  useEffect(() => {
    runInAction(() => {
      store.tokens = props.tokens;
    });
  }, [props.tokens]);

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
        store.isOpen = false;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClickItem = (tag: Option) => {
    // Clicking implies selecting and resetting the input
    if (props.searchOnSelect !== false) {
      props.onAdd(tag.value);
      runInAction(() => {
        store.query = "";
        store.isOpen = false;
      });
    } else {
      runInAction(() => {
        store.query = tag.value;
      });
    }

    inputRef.current?.focus(); // Keep focus
  };

  const handleEnter = () => {
    // If a dropdown selection is focused, infer Enter as selecting it
    if (store.isDropdownOpen && store.focusedOption) {
      if (props.searchOnSelect !== false) {
        // On Edit page, clicking option == clicking tag, execute search and empty input
        props.onAdd(store.focusedOption.value);
        runInAction(() => {
          store.query = "";
          store.isOpen = false;
        });
      } else {
        // Documents search page, options aren't final values, just prefixes, so add
        // to input to let user finish filling out search
        runInAction(() => {
          store.query = store.focusedOption!.value;
        });
      }
    } else {
      // Otherwise, infer as creating a new tag / search
      props.onAdd(store.query);
      runInAction(() => {
        store.query = "";
        store.isOpen = false;
      });
    }
  };

  return (
    <div
      className={cn(
        "flex max-w-full flex-grow flex-col rounded-sm border bg-background text-xs drag-none",
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
          value={store.query}
          onChange={(e) => {
            runInAction(() => {
              store.query = e.target.value;
              store.isOpen = true;
            });
          }}
          onBlur={() =>
            runInAction(() => {
              store.isOpen = false;
            })
          }
          onKeyDown={(e) => {
            if (e.key === "Backspace" && e.currentTarget.value === "") {
              // When typeable input is empty, interpret additional backspaces
              // as "clear the last tag" (the one closest to cursor)
              if (props.tokens.length) {
                props.onRemove(props.tokens[props.tokens.length - 1]);
                // setTimeout(() => inputRef.current?.focus(), 0); // Refocus the input
              }
            }

            if (store.isDropdownOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                store.handleArrowDown();

                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                store.handleArrowUp();

                return;
              }
            }

            // Enter always implies to fire selection
            if (e.key === "Enter") {
              e.preventDefault();
              handleEnter();
            }

            // I'm angry, get me out of here! (close dropdown)
            if (e.key === "Escape") {
              runInAction(() => {
                store.isOpen = false;
              });
            }
          }}
          onFocus={() => {
            store.isOpen = true;
          }}
        />
      </div>
      <div className="relative">
        {store.isDropdownOpen && (
          <div
            className={cn(
              "absolute left-0 top-1 z-10 mt-2 max-h-60 w-full overflow-y-auto",
              "bg-secondary/80 shadow-md backdrop-blur-sm",
              "border-b border-l border-r border-accent",
            )}
          >
            {store.filteredOptions.slice(0, 10).map((tag, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex cursor-pointer justify-between p-2 hover:bg-accent hover:text-accent-foreground",
                  idx === store.focusedIdx &&
                    "bg-accent text-accent-foreground",
                )}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleClickItem(tag);
                }}
                onMouseEnter={() =>
                  runInAction(() => {
                    store.focusedIdx = idx;
                  })
                }
              >
                <span>{tag.value}</span>
                {tag.label && (
                  <span className="text-foreground">{tag.label}</span>
                )}
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
    "mr-1 flex flex-shrink cursor-pointer items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border px-1.5 py-1 text-xs hover:opacity-80 transition-opacity",
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
