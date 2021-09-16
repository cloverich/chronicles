// import { useSelected, useFocused, useSlateStatic } from 'slate-react';
import React from 'react';
import { ReactEditor, RenderElementProps } from 'slate-react';
import { Transforms, Editor, Path as SlatePath, Element as SlateElement, Range, Selection } from 'slate';
import { isLinkElement, LinkElement } from '../util';
import { IconButton, Tooltip   } from 'evergreen-ui';
import { css } from "emotion";

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
  // Transforms.unwrapNodes(editor, {
  //   match: n =>
  //     !Editor.isEditor(n) && isLinkElement(n),
  // })
}

export const wrapLink = (editor: Editor, node: SlateElement | Selection, url: string) => {
  // if (isLinkActive(editor)) {
  //   unwrapLink(editor)
  // }

  // hmm.... unwrapLink just modified the node... fuck what now... 
  // Actually.. 
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

  // todo: refactor
  const isCollapsed = selection && Range.isCollapsed(selection)
  const link: LinkElement = {
    type: 'link',
    url,
    title: null,
    children: isCollapsed ? [{ text: url }] : [],
  }

  if (isCollapsed) {
    Transforms.insertNodes(editor, link, { at: selection! })
  } else {
    Transforms.wrapNodes(editor, link, { split: true, at: selection! })
    Transforms.collapse(editor, { edge: 'end',  })
  }
}


// const insertLink = (editor: ReactEditor, url: string) => {
//   if (!url) return;

//   const { selection } = editor;
//   const link = createLinkNode(url, "New Link");

//   ReactEditor.focus(editor);

//   if (!!selection) {
//     const [parentNode, parentPath] = Editor.parent(
//       editor,
//       selection.focus?.path
//     );

//     // Remove the Link node if we're inserting a new link node inside of another
//     // link.
//     if (isLinkElement(parentNode)) {
//       removeLink(editor);
//     }

//     if (editor.isVoid(parentNode)) {
//       // Insert the new link after the void node
//       Transforms.insertNodes(editor, createParagraphNode([link]), {
//         at: SlatePath.next(parentPath),
//         select: true
//       });
//     } else if (Range.isCollapsed(selection)) {
//       // Insert the new link in our last known location
//       Transforms.insertNodes(editor, link, { select: true });
//     } else {
//       // Wrap the currently selected range of text into a Link
//       Transforms.wrapNodes(editor, link, { split: true });
//       // Remove the highlight and move the cursor to the end of the highlight
//       Transforms.collapse(editor, { edge: "end" });
//     }
//   } else {
//     // Insert the new link node at the bottom of the Editor when selection
//     // is falsey
//     Transforms.insertNodes(editor, createParagraphNode([link]));
//   }
// };

// todo: consider moving this and link components to links specific file
import { useSelected, useFocused, useSlateStatic } from 'slate-react';


interface LinkElementProps extends RenderElementProps {
  element: LinkElement;
}

export const Link = ({ attributes, element, children }: LinkElementProps) => {
  const editor = useSlateStatic() as Editor;
  const selected = useSelected();
  const focused = useFocused();
  const ref = useRef<HTMLDivElement>(null)

  // console.log(selected, focused);
  // focused is, I think, the editor being focused
  // selected is _this_ node being selected
  // they are booleans.

  // useEffect(() => {
  //   const el = ref.current
  //   const { selection } = editor

  //   if (!el) {
  //     return
  //   }

  //   if (
  //     !selected || !focused

  //     // The Slate example relies on selected text, I want this to pop up
  //     // if the cursor is even on the text
  //     // !selection ||
  //     // !ReactEditor.isFocused(editor) ||
  //     // Range.isCollapsed(selection) ||
  //     // Editor.string(editor, selection) === ''
  //   ) {
  //     el.removeAttribute('style')
  //     return
  //   }

  //   const domSelection = window.getSelection()

  //   // todo: handle null ref
  //   const domRange = domSelection!.getRangeAt(0)
  //   const rect = domRange.getBoundingClientRect()
  //   el.style.opacity = '1'
  //   // el.style.top = `${window.pageYOffset - el.offsetHeight}px`
  //   el.style.top = `${rect.top - rect.height + 'px'}`;
  //   // rect.
  //   // console.log(el, rect, domRange);
  //   el.style.left = `${rect.left +
  //     window.pageXOffset -
  //     el.offsetWidth / 2 +
  //     rect.width / 2}px`
  // })


  return (
    // <div className="element-link">
      <a {...attributes} href={element.url}>
        {children}
      </a>
      
    // </div>
  );
};

// {selected && focused && (
//   <div className={css`
//     position: absolute;
//     z-index: 2;
//     opacity: 0;
//     transition: opacity 0.2s;
//   `}
//   ref={ref}
//   >
//   <div 
//     className={css`
//       margin-left: 10px;
//       padding: 5px 5px 5px 5px;
//       border: 1px solid grey;
//       display: flex;
//       box-shadow: 5px 5px #ccc;
      
//     `} 
//     contentEditable={false}
//   >
//     <a href={element.url} rel="noreferrer" target="_blank">
//       {/* <FontAwesomeIcon icon={faExternalLinkAlt} /> */}
//       {element.url}
//     </a>
//     <IconButton style={{marginLeft: '5px'}} icon="remove"  onClick={() => removeLink(editor as ReactEditor)} />
//   </div>
//   <div></div>
//   </div>
// )}

import { useRef, useEffect } from 'react';
import { useSlate } from 'slate-react';
import { Portal, Menu } from './menu';


export const HoveringToolbar = () => {
  const ref = useRef<HTMLDivElement>()
  const editor = useSlate() as Editor;

  

  useEffect(() => {
    const el = ref.current
    const { selection } = editor

    if (!el) {
      return
    }

    if (
      !selection ||
      !ReactEditor.isFocused(editor as ReactEditor) ||
      Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === ''
    ) {
      el.removeAttribute('style')
      return
    }

    const domSelection = window.getSelection()

    // todo: handle null ref
    const domRange = domSelection!.getRangeAt(0)
    const rect = domRange.getBoundingClientRect()
    el.style.opacity = '1'
    el.style.top = `${rect.top + window.pageYOffset - el.offsetHeight}px`
    el.style.left = `${rect.left +
      window.pageXOffset -
      el.offsetWidth / 2 +
      rect.width / 2}px`
  })

  return (
    <Portal>
      <Menu
        ref={ref as any} // todo: Fix the types
        className={css`
          padding: 8px 7px 6px;
          position: absolute;
          z-index: 1;
          top: -10000px;
          left: -10000px;
          margin-top: -6px;
          opacity: 0;
          background-color: #222;
          border-radius: 4px;
          transition: opacity 0.75s;
        `}
      >
        Oh yeah!
        {/* <FormatButton format="bold" icon="format_bold" />
        <FormatButton format="italic" icon="format_italic" />
        <FormatButton format="underlined" icon="format_underlined" /> */}
      </Menu>
    </Portal>
  )
}


// const FormatButton = ({ format, icon }) => {
//   const editor = useSlate()
//   return (
//     <Button
//       reversed
//       active={isFormatActive(editor, format)}
//       onMouseDown={event => {
//         event.preventDefault()
//         toggleFormat(editor, format)
//       }}
//     >
//       <Icon>{icon}</Icon>
//     </Button>
//   )
// }


// const toggleFormat = (editor, format) => {
//   const isActive = isFormatActive(editor, format)
//   Transforms.setNodes(
//     editor,
//     { [format]: isActive ? null : true },
//     { match: Text.isText, split: true }
//   )
// }

// const isFormatActive = (editor, format) => {
//   const [match] = Editor.nodes(editor, {
//     match: n => n[format] === true,
//     mode: 'all',
//   })
//   return !!match
// }


