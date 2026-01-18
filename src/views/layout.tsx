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
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {children}
    </div>
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
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
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
  return <div className="h-(--titlebar-height) min-h-(--titlebar-height)" />;
};

/**
 * Add padding at the bottom of ScrollContainer without disrupting the scrollbar on the parent.
 * See Container for usage.
 */
export const BottomSpacer: React.FC<ClickableDivProps> = ({
  onClick,
  onMouseDown,
}) => {
  return (
    <div
      className="h-16 min-h-16"
      onClick={onClick || noop}
      onMouseDown={onMouseDown}
    />
  );
};

/**
 * Scrollable container for main content. See Container for usage.
 */
export const ScrollContainer: React.FC<ClickableDivProps> = ({
  children,
  onClick,
  onMouseDown,
}) => {
  return (
    <div
      className="flex grow flex-col overflow-y-auto p-12"
      onClick={onClick || noop}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
};
