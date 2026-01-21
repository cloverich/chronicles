import {
  useLinkToolbarButton,
  useLinkToolbarButtonState,
} from "@platejs/link/react";
import React from "react";

import { Icons } from "../../../../../components/icons";
import { ToolbarButton } from "../../components/Toolbar";

export const LinkToolbarButton = React.forwardRef<
  React.ElementRef<typeof ToolbarButton>,
  React.ComponentPropsWithoutRef<typeof ToolbarButton>
>((rest, ref) => {
  const state = useLinkToolbarButtonState();
  const { props } = useLinkToolbarButton(state);

  return (
    <ToolbarButton ref={ref} tooltip="Link" {...props} {...rest}>
      <Icons.link size={16} />
    </ToolbarButton>
  );
});

LinkToolbarButton.displayName = "LinkToolbarButton";
