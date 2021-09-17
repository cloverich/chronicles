import React, { PropsWithChildren, Ref } from 'react';
import ReactDOM from 'react-dom';
import { cx, css } from 'emotion';
import { useRef, useEffect } from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Range } from 'slate';

/**
 * Contents started from:
 * https://github.com/ianstormtaylor/slate/blob/main/site/components.tsx
 * 
 * Partially used while developing another feature before rolling my own.
 * Will revisit using these for the proper hovering toolbar.
 */

interface BaseProps {
  className: string
  [key: string]: unknown
}

type OrNull<T> = T | null
type OrUndef<T> = T | undefined;

export const Menu = React.forwardRef(
  (
    { className, ...props }: PropsWithChildren<BaseProps>,
    ref: Ref<HTMLDivElement>
  ) => (
    <div
      {...props}
      ref={ref}
      className={cx(
        // todo: review this CSS
        className,
        css`
          & > * {
            display: inline-block;
          }
          & > * + * {
            margin-left: 15px;
          }
        `
      )}
    />
  )
)

export const Portal = ({ children }: PropsWithChildren<any>) => {
  return typeof document === 'object'
    ? ReactDOM.createPortal(children, document.body)
    : null
}



export const HoveringToolbar = () => {
  const ref = useRef<HTMLDivElement>()
  const editor = useSlate() as ReactEditor;

  

  useEffect(() => {
    const toolbar = ref.current
    const { selection } = editor

    if (!toolbar) {
      return
    }

    if (
      !selection ||
      !ReactEditor.isFocused(editor as ReactEditor) ||
      Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === ''
    ) {
      toolbar.removeAttribute('style')
      return
    }

    // todo: review whether doing this through Slate (like i do for links) is preferable
    const domSelection = window.getSelection()

    // todo: handle null ref
    const domRange = domSelection!.getRangeAt(0)
    const rect = domRange.getBoundingClientRect()
    toolbar.style.opacity = '1'
    toolbar.style.top = `${rect.top + window.pageYOffset - toolbar.offsetHeight}px`
    toolbar.style.left = `${rect.left +
      window.pageXOffset -
      toolbar.offsetWidth / 2 +
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
        {/* <FormatButton format="bold" icon="format_bold" />
        <FormatButton format="italic" icon="format_italic" />
        <FormatButton format="underlined" icon="format_underlined" /> */}
      </Menu>
    </Portal>
  )
}