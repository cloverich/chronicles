import React from "react";

/**
 * Main content container.
 *
 * Usage:
 *
 * ```
 * import * as Base from "../layout";
 *
 * <Base.Container>
 *   <Titlebar />
 *   <Base.TitlebarSpacer />
 *   <Base.ScrollContainer>
 *     {...page content here...}
 *   </Base.ScrollContainer>
 * </Base.Container>
 * ```
 */
export const Container: React.FC<ClickableDivProps> = ({ children }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden">{children}</div>
  );
};

const noop = () => {};

/**
 * For wrapping divs that are optionally clickable; specifically supporting
 * the editor focus-on-click behavior, accounting for the fact that these wrappers
 * are also used outside the editor page.
 */
interface ClickableDivProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

export const EditorContainer: React.FC<ClickableDivProps> = ({ children }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden">{children}</div>
  );
};

/**
 * Add space equivalent to the fixed position titlebar. See Container for usage.
 */
export const TitlebarSpacer = () => {
  return <div className="h-12 min-h-12" />;
};

/**
 * Add padding at the bottom of ScrollContainer without disrupting the scrollbar on the parent.
 * See Container for usage.
 */
export const BottomSpacer: React.FC<ClickableDivProps> = ({ onClick }) => {
  return <div className="h-16 min-h-16" onClick={onClick || noop} />;
};

/**
 * Scrollable container for main content. See Container for usage.
 */
export const ScrollContainer: React.FC<ClickableDivProps> = ({
  children,
  onClick,
}) => {
  return (
    <div
      className="flex flex-grow flex-col overflow-y-scroll p-12"
      onClick={onClick || noop}
    >
      {children}
    </div>
  );
};
