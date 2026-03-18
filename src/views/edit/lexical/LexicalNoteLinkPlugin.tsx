import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import React from "react";
import { useNavigate } from "react-router-dom";
import type { SearchItem } from "../../documents/SearchStore";
import { parseNoteLink } from "../editorv2/features/note-linking/toMdast";
import { $createChroniclesNoteLinkNode } from "./ChroniclesNoteLinkNode";

interface MatchState {
  end: number;
  nodeKey: string;
  query: string;
  start: number;
}

const NOTE_LINK_TRIGGER = /(^|[\s([{])@([^\s@]*)$/;

function matchNoteLinkTrigger(): MatchState | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  if (!$isTextNode(anchorNode)) {
    return null;
  }

  const anchorOffset = selection.anchor.offset;
  const beforeCursor = anchorNode.getTextContent().slice(0, anchorOffset);
  const match = beforeCursor.match(NOTE_LINK_TRIGGER);
  if (!match) {
    return null;
  }

  return {
    end: anchorOffset,
    nodeKey: anchorNode.getKey(),
    query: match[2] ?? "",
    start: beforeCursor.length - match[0].length + match[1].length,
  };
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0;
  }

  return ((index % count) + count) % count;
}

export function LexicalNoteLinkPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const navigate = useNavigate();
  const [match, setMatch] = React.useState<MatchState | null>(null);
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const latestMatchRef = React.useRef<MatchState | null>(null);
  const latestResultsRef = React.useRef<SearchItem[]>([]);

  latestMatchRef.current = match;
  latestResultsRef.current = results;

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let next: MatchState | null = null;
      editorState.read(() => {
        next = matchNoteLinkTrigger();
      });

      setMatch((current) => {
        if (
          current?.nodeKey === next?.nodeKey &&
          current?.start === next?.start &&
          current?.end === next?.end &&
          current?.query === next?.query
        ) {
          return current;
        }

        return next;
      });
    });
  }, [editor]);

  React.useEffect(() => {
    if (!match || typeof window === "undefined" || !window.chronicles) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    let disposed = false;
    const query = match.query.trim();
    const searchQuery = query
      ? { journals: [], titles: [query] }
      : { journals: [], limit: 10 };

    window.chronicles
      .getClient()
      .documents.search(searchQuery)
      .then((response) => {
        if (disposed) {
          return;
        }

        setResults(response.data);
        setSelectedIndex((current) =>
          clampIndex(current, Math.max(response.data.length, 1)),
        );
      })
      .catch(() => {
        if (!disposed) {
          setResults([]);
          setSelectedIndex(0);
        }
      });

    return () => {
      disposed = true;
    };
  }, [match]);

  const insertNoteLink = React.useCallback(
    (item: SearchItem) => {
      const activeMatch = latestMatchRef.current;
      if (!activeMatch) {
        return;
      }

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const anchorNode = selection.anchor.getNode();
        if (
          !$isTextNode(anchorNode) ||
          anchorNode.getKey() !== activeMatch.nodeKey
        ) {
          return;
        }

        const splitNodes = anchorNode.splitText(
          activeMatch.start,
          selection.anchor.offset,
        );
        const selectedNode =
          splitNodes[activeMatch.start === 0 ? 0 : 1] ?? splitNodes[0];
        const noteLinkNode = $createChroniclesNoteLinkNode(
          `../${item.journal}/${item.id}.md`,
          { title: item.title || item.id },
        );

        noteLinkNode.append($createTextNode(item.title || item.id));
        selectedNode.replace(noteLinkNode);

        const spacer = $createTextNode(" ");
        noteLinkNode.insertAfter(spacer);
        spacer.select();
      });

      setMatch(null);
      setResults([]);
      setSelectedIndex(0);
    },
    [editor],
  );

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          if (!event || !(event.target instanceof Element)) {
            return false;
          }

          const anchor = event.target.closest(
            "[data-chronicles-note-link='true']",
          );
          if (!anchor) {
            return false;
          }

          const href = anchor.getAttribute("href");
          const parsed = href ? parseNoteLink(href) : null;
          if (!parsed) {
            return false;
          }

          event.preventDefault();
          navigate(`/documents/edit/${parsed.noteId}`);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (
            !latestMatchRef.current ||
            latestResultsRef.current.length === 0
          ) {
            return false;
          }

          event?.preventDefault();
          setSelectedIndex((current) =>
            clampIndex(current + 1, latestResultsRef.current.length),
          );
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (
            !latestMatchRef.current ||
            latestResultsRef.current.length === 0
          ) {
            return false;
          }

          event?.preventDefault();
          setSelectedIndex((current) =>
            clampIndex(current - 1, latestResultsRef.current.length),
          );
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const item = latestResultsRef.current[selectedIndex];
          if (!latestMatchRef.current || !item) {
            return false;
          }

          event?.preventDefault();
          insertNoteLink(item);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!latestMatchRef.current) {
            return false;
          }

          event?.preventDefault();
          setMatch(null);
          setResults([]);
          setSelectedIndex(0);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, insertNoteLink, navigate, selectedIndex]);

  if (!match) {
    return null;
  }

  return (
    <div className="border-border bg-popover absolute top-full left-0 z-20 mt-3 w-full max-w-md rounded-md border shadow-lg">
      <div className="border-border text-muted-foreground border-b px-3 py-2 text-xs">
        Link a Chronicles note
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {results.length === 0 ? (
          <div className="text-muted-foreground px-3 py-2 text-sm">
            No matching notes
          </div>
        ) : (
          results.slice(0, 10).map((item, index) => {
            const isActive = index === selectedIndex;

            return (
              <button
                key={item.id}
                type="button"
                className={[
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                  isActive ? "bg-muted" : "hover:bg-muted/60",
                ].join(" ")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertNoteLink(item)}
              >
                <span className="truncate">{item.title || item.id}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {item.journal}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
