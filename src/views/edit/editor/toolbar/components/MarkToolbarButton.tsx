import { withRef } from "@udecode/cn";
import {
  useMarkToolbarButton,
  useMarkToolbarButtonState,
} from "@udecode/plate/react";
import React from "react";
import { Icons } from "../../../../../components/icons";
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
    icon: keyof typeof Icons;
    clear?: string | string[];
  }
>(({ icon, clear, nodeType, ...rest }, ref) => {
  const state = useMarkToolbarButtonState({ clear, nodeType });
  const { props } = useMarkToolbarButton(state);
  const Icon = Icons[icon];

  return (
    <ToolbarButton ref={ref} {...props} {...rest} size="inherit">
      <Icon size={16} />
    </ToolbarButton>
  );
});
