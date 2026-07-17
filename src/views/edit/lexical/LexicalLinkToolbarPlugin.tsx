import { $createLinkNode, $isLinkNode, type LinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  type LexicalNode,
} from "lexical";
import React from "react";
import { createPortal } from "react-dom";
import { Separator } from "../../../components/Separator";
import { buttonVariants } from "../components/Button";

interface LinkToolbarPosition {
  left: number;
  top: number;
}

interface LinkToolbarState {
  key: string;
  position: LinkToolbarPosition;
  text: string;
  url: string;
}

const TOOLBAR_OFFSET_PX = 8;

const popoverClasses =
  "z-50 w-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden";
const inputClasses =
  "flex h-[28px] w-full rounded-md border-none bg-transparent px-1.5 py-1 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-transparent md:text-sm";

function isChroniclesNoteLink(node: LinkNode): boolean {
  return node.getType() === "chronicles-note-link";
}

function findLinkNodeByState(
  node: LexicalNode,
  state: Pick<LinkToolbarState, "text" | "url">,
): LinkNode | null {
  if ($isLinkNode(node)) {
    const linkNode = node as LinkNode;
    if (
      !isChroniclesNoteLink(linkNode) &&
      linkNode.getURL() === state.url &&
      linkNode.getTextContent() === state.text
    ) {
      return linkNode;
    }
  }

  if (!$isElementNode(node)) {
    return null;
  }

  for (const child of node.getChildren()) {
    const match = findLinkNodeByState(child, state);
    if (match) {
      return match;
    }
  }

  return null;
}

function targetToElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function getToolbarPosition(anchor: HTMLAnchorElement): LinkToolbarPosition {
  const rect = anchor.getBoundingClientRect();
  return {
    left: Math.max(8, rect.left),
    top: Math.max(8, rect.bottom + TOOLBAR_OFFSET_PX),
  };
}

export function LexicalLinkToolbarPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [toolbarState, setToolbarState] =
    React.useState<LinkToolbarState | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState("");
  const [draftUrl, setDraftUrl] = React.useState("");
  const activeAnchorRef = React.useRef<HTMLAnchorElement | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);

  const closeToolbar = React.useCallback(() => {
    activeAnchorRef.current = null;
    setToolbarState(null);
    setIsEditing(false);
  }, []);

  const syncToolbarPosition = React.useCallback(() => {
    const anchor = activeAnchorRef.current;
    if (!anchor) {
      return;
    }

    const nextPosition = getToolbarPosition(anchor);
    setToolbarState((current) => {
      if (!current) {
        return current;
      }

      if (
        current.position.left === nextPosition.left &&
        current.position.top === nextPosition.top
      ) {
        return current;
      }

      return {
        ...current,
        position: nextPosition,
      };
    });
  }, []);

  const openToolbarForAnchor = React.useCallback(
    (anchor: HTMLAnchorElement) => {
      const selectedState: LinkToolbarState = {
        key: "",
        position: getToolbarPosition(anchor),
        text: anchor.textContent ?? "",
        url: anchor.getAttribute("href") ?? "",
      };

      activeAnchorRef.current = anchor;
      setToolbarState(selectedState);
      setDraftText(selectedState.text);
      setDraftUrl(selectedState.url);
      setIsEditing(false);
    },
    [],
  );

  React.useEffect(() => {
    return editor.registerRootListener((rootElement, prevRootElement) => {
      const handleClick = (event: MouseEvent) => {
        const target = targetToElement(event.target);
        if (!target) {
          return;
        }

        const anchor = target.closest("a");
        if (
          !(anchor instanceof HTMLAnchorElement) ||
          anchor.hasAttribute("data-chronicles-note-link")
        ) {
          return;
        }

        event.preventDefault();
        openToolbarForAnchor(anchor);
      };

      prevRootElement?.removeEventListener("click", handleClick);
      rootElement?.addEventListener("click", handleClick);

      return () => {
        rootElement?.removeEventListener("click", handleClick);
      };
    });
  }, [editor, openToolbarForAnchor]);

  React.useEffect(() => {
    if (!toolbarState) {
      return;
    }

    syncToolbarPosition();
    window.addEventListener("resize", syncToolbarPosition);
    window.addEventListener("scroll", syncToolbarPosition, true);

    return () => {
      window.removeEventListener("resize", syncToolbarPosition);
      window.removeEventListener("scroll", syncToolbarPosition, true);
    };
  }, [isEditing, syncToolbarPosition, toolbarState]);

  React.useEffect(() => {
    if (!toolbarState) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = targetToElement(event.target);
      if (!target) {
        closeToolbar();
        return;
      }

      if (target.closest("[data-lexical-link-toolbar='true']")) {
        return;
      }

      closeToolbar();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeToolbar, toolbarState]);

  React.useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (!toolbarState) {
          return false;
        }

        closeToolbar();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [closeToolbar, editor, toolbarState]);

  const resolveLinkNode = React.useCallback(
    (state: LinkToolbarState): LinkNode | null => {
      const node = (
        state.key
          ? $getNodeByKey(state.key)
          : findLinkNodeByState($getRoot(), state)
      ) as LinkNode | null;
      if (!$isLinkNode(node)) {
        return null;
      }

      const linkNode = node as LinkNode;
      if (isChroniclesNoteLink(linkNode)) {
        return null;
      }

      return linkNode;
    },
    [],
  );

  const openLink = React.useCallback(() => {
    if (!toolbarState) {
      return;
    }

    window.open(toolbarState.url, "_blank");
  }, [toolbarState]);

  const saveEdits = React.useCallback(() => {
    if (!toolbarState) {
      return;
    }

    editor.update(() => {
      const linkNode = resolveLinkNode(toolbarState);
      if (!linkNode) {
        return;
      }

      const replacement = $createLinkNode(draftUrl, {
        rel: linkNode.getRel(),
        target: linkNode.getTarget(),
        title: linkNode.getTitle(),
      });
      replacement.append($createTextNode(draftText));
      linkNode.replace(replacement);
    });

    closeToolbar();
  }, [
    closeToolbar,
    draftText,
    draftUrl,
    editor,
    resolveLinkNode,
    toolbarState,
  ]);

  const unlink = React.useCallback(() => {
    if (!toolbarState) {
      return;
    }

    editor.update(() => {
      const linkNode = resolveLinkNode(toolbarState);
      if (!linkNode) {
        return;
      }

      const children = linkNode.getChildren();
      for (const child of children) {
        linkNode.insertBefore(child);
      }
      linkNode.remove();
    });

    closeToolbar();
  }, [closeToolbar, editor, resolveLinkNode, toolbarState]);

  if (!toolbarState) {
    return null;
  }

  const portalRoot = typeof document === "undefined" ? null : document.body;
  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <div
      ref={toolbarRef}
      data-lexical-link-toolbar="true"
      data-testid="lexical-link-toolbar"
      className={popoverClasses}
      style={{
        left: `${toolbarState.position.left}px`,
        position: "fixed",
        top: `${toolbarState.position.top}px`,
      }}
    >
      {isEditing ? (
        <div className="flex w-[330px] flex-col">
          <label className="text-muted-foreground px-1 pb-0.5 text-xs">
            Link
          </label>
          <input
            aria-label="Link URL"
            className={inputClasses}
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
          />

          <Separator className="my-1" />

          <label className="text-muted-foreground px-1 pb-0.5 text-xs">
            Text to display
          </label>
          <input
            aria-label="Link text"
            className={inputClasses}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />

          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              onClick={saveEdits}
            >
              Save
            </button>
            <button
              type="button"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="box-content flex items-center">
          <button
            type="button"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            onClick={() => setIsEditing(true)}
          >
            Edit link
          </button>

          <Separator orientation="vertical" />

          <button
            type="button"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            onClick={openLink}
          >
            Open link
          </button>

          <Separator orientation="vertical" />

          <button
            type="button"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            onClick={unlink}
          >
            Unlink
          </button>
        </div>
      )}
    </div>,
    portalRoot,
  );
}
