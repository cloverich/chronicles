import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ReactEditor, RenderElementProps, useSlate } from "slate-react";
import { Transforms, Element as SlateElement, Editor, Selection, Range } from "slate";
import { isLinkElement, LinkElement } from '../util';
import { css } from "emotion";
import { TextInputField, Button } from 'evergreen-ui'


const urlRegex = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
export const urlMatcher = new RegExp(urlRegex);

// https://dev.to/koralarts/slatejs-adding-images-and-links-2g93
const createLinkNode = (href: string, text: string) => ({
  type: "link",
  href,
  children: [{ text }]
});

// guessing at this one, wasn't in tutorial
function createParagraphNode(children: any[]) {
  return {
    type: 'paragraph',
    children,
  }
}

export const removeLink = (editor: Editor, node: LinkElement, opts = {}) => {
  // Hmm... if you pass an existing LinkNode in...
  Transforms.unwrapNodes(editor, {
    ...opts,
    // todo: does this work?
    match: n => n === node,
    // match: (n) =>
    //   !Editor.isEditor(n) && isLinkElement(n)
  });
};


// todo: re-order url for consistency
export const insertLink = (editor: Editor, url: string, node: SlateElement | Selection) => {
  wrapLink(editor, node, url)
}

const isLinkActive = (editor: Editor) => {
  const [link] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) && isLinkElement(n),
  })
  return !!link
}

export const unwrapLink = (editor: Editor, node: SlateElement) => {
  Transforms.unwrapNodes(editor, { match: n => n === node})
}

export const wrapLink = (editor: Editor, node: SlateElement | Selection, url: string) => {
  if (isLinkElement(node)) {
    Transforms.setNodes(
      editor, 
      { url } as any, 
      { 
        match: n => n === node,
        // the active selection may not be correct. Instead, search the whole document for
        // this node. Probably a better way to do this.
        // todo: investigate whether mutating the node's URL directly accomplishes this
        at: [],
      })
    return;
  }

  const selection = node as Selection;

  const isCollapsed = selection && Range.isCollapsed(selection)
  if (isCollapsed) {
    const link: LinkElement = {
      type: 'link',
      url,
      title: null,
      children: [{ text: url }],
    }
    Transforms.insertNodes(editor, link, { at: selection! })

  } else {
    const link: LinkElement = {
      type: 'link',
      url,
      title: null,
      children: [],
    }
    Transforms.wrapNodes(editor, link, { split: true, at: selection! })
    Transforms.collapse(editor, { edge: 'end',  })
  }
}


export function EditLinkMenus() {
  // todo: investigate useRef (does not trigger render) instead of useState
  const [isEditing, setEditingState] = useState<boolean>(false);
  const [isViewing, setIsViewing] = useState<boolean>(false);
  const [linkNode, setLinkNodeState] = useState<LinkElement | Selection | null>(null);
  const editor = useSlate();
  const menu = useRef<HTMLDivElement | undefined>()

  // url form value
  const [editUrl, setEditUrl] = useState<string>('')

  function setLinkNode(to: LinkElement | Selection) {
    setLinkNodeState(to);
    if (isLinkElement(to) && menu.current) {
      const domNode = ReactEditor.toDOMNode(editor as ReactEditor, to);
      const rect = domNode.getBoundingClientRect();

      // ok. The rect.top is relative to the window
      // The menu's top is relative to the container (or maybe the body)
      // So once we scroll we need to push the menu down by scrollY, in addition to its
      // normal offset
      menu.current.style.top = rect.top + 8 + rect.height + window.scrollY + 'px';
      menu.current.style.left = rect.left + 16 + window.scrollX + 'px';
      setIsViewing(true);
    } else {
      setIsViewing(false);
      if (!menu.current) return;
      menu.current.style.left = '-10000px';
    }
  }

  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: Event) {
      // todo: figure out types
        if (menu.current && !menu.current.contains(event.target as any)) {
          setIsViewing(false);
          setEditing(false);
        }
    }

    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keypress", handleClickOutside);
    return () => {
        // Unbind the event listener on clean up
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keypress", handleClickOutside);
    };
}, [menu]);

  function setEditing(editing: boolean) {
    // todo: viewing state... 


    // When exiting edit mode, unset the url form value
    // Cancelling or Save completed
    if (!editing) {

      setEditUrl('');
      
      // Intent was to close menu, but the view state re-populates because I think the 
      // re-render pulls the prior selection out of editor.selection (even though there's no 
      // cursor in the UI)
      // todo: Consider re-enabling viewing when existing editing... 
      setNull();
    } else {
      // disable viewing mode when editing. Hmmm...
      setIsViewing(false);
      if (isLinkElement(linkNode)) {
        setEditUrl(linkNode.url);
      } else {
        // may need the current selection here...
        console.log(editor.selection);
      }
    }

    setEditingState(editing);

    // todo: I also think when editing ends... the _last_ editor selection should run through
    // the "watch selection" so e.g. the view does not still show an old link or something.
  }

  // conditionally nullify stored linkNode
  // I feel like React did this value checking for you ,but I got a loop
  // so shrug
  function setNull() { 
    if (linkNode !== null) {
      setLinkNodeState(null);
      // hide menu
      if (!menu.current) return;
      menu.current.style.left = '-10000px';
    }
  }

  function save() {
    if (!linkNode) {
      // todo: When we use the edit menu for new links this will need to work
      // for now you can only add links by highlighting text and pasting from clipboard
      console.error('save called but linkNode is null. Probably chris did not finish refactoring');
      return;
    }

    // Validate URL
    if (editUrl) {
      // todo: if editUrl is blank, but linkNode is not... should ac
      // create or replace a linkNode
      insertLink(editor, editUrl, linkNode)
    } else {
      if (isLinkElement(linkNode)) {
        removeLink(editor, linkNode);
      }
    }

    setEditing(false);
  }

  function cancel() {
    // cancel editing... 
    setEditing(false);
  }

  function remove() {
    if (!isLinkElement(linkNode)) return;

    // unwrap link node
    removeLink(editor, linkNode)
  }

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

      const [parent] = Editor.parent(editor, editor.selection)

      if (isLinkElement(parent)) {
        // Only update state if the element changed
        if (linkNode !== parent) {
          setLinkNode(parent);
        }
      } else {
        setLinkNode(editor.selection)
      }
    } else {
      setNull();
    }
  })

  function renderEditing() {
    return (
      <div className={css`padding: 16px`}>
        <p>Edit Link Form</p>
        <TextInputField
          label="URL"
          placeholder="Enter URL for the link"
          value={editUrl}
          onChange={(e: any) => setEditUrl(e.target.value)}
        />
        <div>
          <Button onClick={() => save()}>Save</Button>
          <Button marginLeft={8} onClick={() => cancel()}>Cancel</Button>
        </div>
      </div>
    )
  }

  function renderViewing() {
    return (
      <div className={css`padding: 16px`}>
        <p>View Link Form</p>
        <p>
          <a href={isLinkElement(linkNode) && linkNode.url || ''}>{isLinkElement(linkNode) && linkNode.url || 'No Url'}</a>
        </p>
        <div>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button marginLeft={8} onClick={() => remove()}>Remove</Button>
        </div>

      </div>
    )
  }

  // todo: fix ref type
  // todo: review accessibility, set menu as "disabled" when its not in view
  return (
    <div ref={menu as any} className={css`
      padding: 8px;
      display: flex;
      justify-content: space-around;
      position: absolute;
      background-color: white;
      left: -10000px;
      z-index: 2;

      border: 1px solid grey;
      display: flex;
      box-shadow: 5px 5px #ccc;
      `}
      >
        {isEditing && renderEditing() || renderViewing() }
    </div>
  )
}