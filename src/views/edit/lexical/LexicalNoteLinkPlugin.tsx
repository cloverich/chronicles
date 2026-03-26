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
import { createPortal } from "react-dom";
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

interface DropdownPosition {
  left: number;
  top: number;
}

const NOTE_LINK_TRIGGER = /(^|[\s([{])@([^\s@]*)$/;
const NOTE_LINK_DROPDOWN_WIDTH_PX = 360;

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

export function LexicalNoteLinkPlugin({
  documentId,
}: {
  documentId?: string;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const navigate = useNavigate();
  const [match, setMatch] = React.useState<MatchState | null>(null);
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [position, setPosition] = React.useState<DropdownPosition | null>(null);
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
      ? { journals: [], limit: 10, titles: [query] }
      : { journals: [], limit: 10 };

    window.chronicles
      .getClient()
      .documents.search(searchQuery)
      .then((response) => {
        if (disposed) {
          return;
        }

        const filtered = documentId
          ? response.data.filter((item) => item.id !== documentId)
          : response.data;
        setResults(filtered);
        setSelectedIndex((current) =>
          clampIndex(current, Math.max(filtered.length, 1)),
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

  React.useEffect(() => {
    if (!match || typeof window === "undefined") {
      setPosition(null);
      return;
    }

    const syncPosition = () => {
      const editorRoot = editor.getRootElement();
      if (!(editorRoot instanceof HTMLElement)) {
        setPosition(null);
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!editorRoot.contains(range.startContainer)) {
        setPosition(null);
        return;
      }

      const getRangeRect = (range as any).getBoundingClientRect;
      const getRangeClientRects = (range as any).getClientRects;
      let rect: DOMRect = editorRoot.getBoundingClientRect();
      if (typeof getRangeRect === "function") {
        rect = getRangeRect.call(range) as DOMRect;
      }

      if (
        rect.width === 0 &&
        rect.height === 0 &&
        typeof getRangeClientRects === "function"
      ) {
        const clientRect = getRangeClientRects.call(range)?.[0];
        if (clientRect) {
          rect = clientRect as DOMRect;
        }
      }

      const maxLeft = Math.max(
        8,
        window.innerWidth - NOTE_LINK_DROPDOWN_WIDTH_PX - 8,
      );
      setPosition({
        left: Math.min(maxLeft, Math.max(8, rect.left)),
        top: Math.max(8, rect.bottom + 8),
      });
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [editor, match]);

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

  if (!match || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="border-border bg-popover z-20 w-[360px] max-w-[calc(100vw-16px)] rounded-md border shadow-lg"
      style={{
        left: `${position.left}px`,
        position: "fixed",
        top: `${position.top}px`,
      }}
    >
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
                  "group text-popover-foreground flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "text-link" : "hover:text-link",
                ].join(" ")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertNoteLink(item)}
              >
                <span
                  className={[
                    "truncate transition-colors",
                    isActive ? "text-link" : "group-hover:text-link",
                  ].join(" ")}
                >
                  {item.title || item.id}
                </span>
                <span
                  className={[
                    "text-muted-foreground shrink-0 text-xs transition-colors",
                    isActive ? "text-link" : "group-hover:text-link",
                  ].join(" ")}
                >
                  {item.journal}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}
