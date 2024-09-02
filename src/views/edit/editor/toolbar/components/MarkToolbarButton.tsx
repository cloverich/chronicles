import { withRef } from "@udecode/cn";
import {
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from "@udecode/plate-common";
import React from "react";
import { ToolbarButton } from "../../components/Toolbar";

/**
 * Toolbar buttons for marks - bold, italic, underline, strikethrough, code, link
 * that show up in the editor toolbar.
 *
 * https://platejs.org/docs/components/mark-toolbar-button
 */

export const MarkToolbarButton = withRef<
  typeof ToolbarButton,
  {
    nodeType: string;
    clear?: string | string[];
  }
>(({ clear, nodeType, ...rest }, ref) => {
  const state = useMarkToolbarButtonState({ clear, nodeType });
  const { props } = useMarkToolbarButton(state);

  return <ToolbarButton ref={ref} {...props} {...rest} />;
});
