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
export const Container = ({ children }: React.PropsWithChildren) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden">{children}</div>
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
export const BottomSpacer = () => {
  return <div className="h-16 min-h-16" />;
};

/**
 * Scrollable container for main content. See Container for usage.
 */
export const ScrollContainer = ({ children }: React.PropsWithChildren) => {
  return (
    <div className="p-12 flex-grow flex flex-col overflow-y-scroll">
      {children}
    </div>
  );
};
