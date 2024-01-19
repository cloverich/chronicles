import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { ReactEditor, RenderElementProps, useSlate } from "slate-react";
import {
  Transforms,
  Element as SlateElement,
  Editor,
  Selection,
  Range,
} from "slate";
import { isLinkElement, LinkElement } from "../../util";
import { css } from "emotion";
import { TextInputField, Button } from "evergreen-ui";

const urlRegex =
  /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
export const urlMatcher = new RegExp(urlRegex);

const createLinkNode = (href: string, text: string) => ({
  type: "link",
  href,
  children: [{ text }],
});

// guessing at this one, wasn't in tutorial
function createParagraphNode(children: any[]) {
  return {
    type: "paragraph",
    children,
  };
}

export const removeLink = (editor: Editor, node: LinkElement, opts = {}) => {
  Transforms.unwrapNodes(editor, {
    ...opts,
    match: (n) => n === node,
  });
};

// todo: re-order url for consistency
export const insertLink = (
  editor: Editor,
  url: string,
  node: SlateElement | Selection,
) => {
  // If selection is already a link, update the URL
  if (isLinkElement(node)) {
    Transforms.setNodes(editor, { url } as any, {
      match: (n) => n === node,
      // setNodes defaults to current selection, but it likely changed since this was called.
      // if user clicked through menu's to activate link.
      // todo: investigate whether mutating the node's URL directly accomplishes this
      at: [],
    });
    return;
  }

  const selection = node as Selection;
  const isCollapsed = selection && Range.isCollapsed(selection);

  if (isCollapsed) {
    // todo: This is for linkifying a focused point... does this even make sense?
    // I think checking for collapsed vs expanding at a higher level might make
    // more sense
    const link: LinkElement = {
      type: "link",
      url,
      title: null,
      children: [{ text: url }],
    };
    Transforms.insertNodes(editor, link, { at: selection! });
  } else {
    const link: LinkElement = {
      type: "link",
      url,
      title: null,
      children: [],
    };
    Transforms.wrapNodes(editor, link, { split: true, at: selection! });
    Transforms.collapse(editor, { edge: "end" });
  }
};

/**
 * Encompass the link view and edit menu and associated listeners
 */
export function EditLinkMenus() {
  const [isEditing, setEditingState] = useState<boolean>(false);
  const [isViewing, setIsViewing] = useState<boolean>(false);
  const [editUrl, setEditUrl] = useState<string>("");

  // see setCachedSelection
  // todo: investigate useRef (does not trigger render) instead of useState
  const [cachedSelection, setCachedSelectionState] = useState<
    LinkElement | Selection | null
  >(null);

  const editor = useSlate();
  const menu = useRef<HTMLDivElement | undefined>();

  // cache the text selection or link and conditionally toggle viewing menu
  function setCachedSelection(to: LinkElement | Selection) {
    setCachedSelectionState(to);

    // If existing link, enable the view menu
    if (isLinkElement(to) && menu.current) {
      const domNode = ReactEditor.toDOMNode(editor as ReactEditor, to);
      const rect = domNode.getBoundingClientRect();

      // The rect.top is relative to the window
      // The menu's top is relative to the container (or maybe the body)
      // So once we scroll we need to push the menu down by scrollY, in addition to its
      // normal offset
      menu.current.style.top =
        rect.top + 8 + rect.height + window.scrollY + "px";
      menu.current.style.left = rect.left + 16 + window.scrollX + "px";
      menu.current.style.visibility = "visible";
      setIsViewing(true);
    } else {
      // Otherwise its highlighted regular text. Eventually we might enable the edit menu
      // to add a new linke (as of now, you paste from clipboard onto selected text)
      setIsViewing(false);
      if (!menu.current) return;
      menu.current.style.left = "-10000px";
      menu.current.style.visibility = "hidden";
    }
  }

  // Close menus if user clicks or types in the document
  useEffect(() => {
    function handleClickOutside(event: Event) {
      // todo: figure out types
      if (menu.current && !menu.current.contains(event.target as any)) {
        setIsViewing(false);
        setEditing(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keypress", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keypress", handleClickOutside);
    };
  }, [menu]);

  // toggle editing and preload or clean-up state
  function setEditing(editing: boolean) {
    // When exiting edit mode, unset the url form value
    // Cancelling or Save completed
    if (!editing) {
      setEditUrl("");

      // Intent was to close menu, but the view state re-populates because I think the
      // re-render pulls the prior selection out of editor.selection (even though there's no
      // cursor in the UI)
      // todo: Consider re-enabling viewing when existing editing...
      setNull();
    } else {
      setIsViewing(false);

      if (isLinkElement(cachedSelection)) {
        setEditUrl(cachedSelection.url);
      }
    }

    setEditingState(editing);
  }

  // conditionally nullify stored linkNode
  // I feel like React did this value checking for you, but I got a loop shrug
  function setNull() {
    if (cachedSelection !== null) {
      setCachedSelectionState(null);
      // hide menu off screen
      if (!menu.current) return;
      menu.current.style.left = "-10000px";
    }
  }

  function save() {
    if (!cachedSelection) {
      // todo: When we use the edit menu for new links this will need to work
      // for now you can only add links by highlighting text and pasting from clipboard
      console.error(
        "save called but linkNode is null. Editing a new link? Need to implement!",
      );
      return;
    }

    // Validate URL
    if (editUrl) {
      // todo: if editUrl is blank, but linkNode is not... should ac
      // create or replace a linkNode
      insertLink(editor, editUrl, cachedSelection);
    } else {
      if (isLinkElement(cachedSelection)) {
        removeLink(editor, cachedSelection);
      }
    }

    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function unlink() {
    if (!isLinkElement(cachedSelection)) return;

    // unwrap link node
    removeLink(editor, cachedSelection);
  }

  // conditionally cache the editor's selection
  useEffect(() => {
    // If already editing, stop tracking changes to what's selected
    // and rely on the existing cached selection to be updated after editing is
    // completed
    if (isEditing || isViewing) return;

    // track the selected text so we know if a link is focused
    if (editor.selection) {
      const [node] = Editor.node(editor, editor.selection);

      // calling Editor.parent on root (editor) node throws an exception
      // This case also passes when I expand a selection beyond the URL in question however
      if (Editor.isEditor(node)) {
        setNull();
        return;
      }

      const [parent] = Editor.parent(editor, editor.selection);

      if (isLinkElement(parent)) {
        // Only update state if the element changed
        if (cachedSelection !== parent) {
          setCachedSelection(parent);
        }
      } else {
        setCachedSelection(editor.selection);
      }
    } else {
      setNull();
    }
  });

  function renderEditingForm() {
    return (
      <div
        className={css`
          padding: 16px;
        `}
      >
        <p>Edit Link Form</p>
        <TextInputField
          label="URL"
          placeholder="Enter URL for the link"
          value={editUrl}
          onChange={(e: any) => setEditUrl(e.target.value)}
        />
        <div>
          <Button onClick={() => save()}>Save</Button>
          <Button marginLeft={8} onClick={() => cancelEdit()}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // For viewing the URL and toggling edit for existing links
  function renderViewingForm() {
    return (
      <div
        className={css`
          padding: 16px;
        `}
      >
        <p>View Link Form</p>
        <p>
          <a
            href={(isLinkElement(cachedSelection) && cachedSelection.url) || ""}
          >
            {(isLinkElement(cachedSelection) && cachedSelection.url) || ""}
          </a>
        </p>
        <div>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button marginLeft={8} onClick={() => unlink()}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // todo: fix ref type
  // todo: review accessibility, set menu as "disabled" when its not in view
  // https://www.smashingmagazine.com/2017/11/building-accessible-menu-systems/
  return (
    <div
      ref={menu as any}
      className={css`
        padding: 8px;
        display: flex;
        justify-content: space-around;
        background-color: white;
        position: absolute;
        left: -10000px;
        z-index: 2;

        border: 1px solid grey;
        display: flex;
        box-shadow: 5px 5px #ccc;

        /* visibility property to ensure tabbing does not unintentionally focus hidden menu */
        visibility: hidden;
      `}
      tabIndex={-1}
    >
      {(isEditing && renderEditingForm()) || renderViewingForm()}
    </div>
  );
}
