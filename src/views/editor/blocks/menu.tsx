import React, { PropsWithChildren, Ref } from 'react';
import ReactDOM from 'react-dom';
import { cx, css } from 'emotion';

/**
 * Contents started from:
 * https://github.com/ianstormtaylor/slate/blob/main/site/components.tsx
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