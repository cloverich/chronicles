import React from "react";
import { withRef } from "@udecode/cn";
import {
  useLinkToolbarButton,
  useLinkToolbarButtonState,
} from "@udecode/plate";

import { ToolbarButton } from "../../components/Toolbar";
import { Icons } from "../../../../../components/icons";

export const LinkToolbarButton = withRef<typeof ToolbarButton>((rest, ref) => {
  const state = useLinkToolbarButtonState();
  const { props } = useLinkToolbarButton(state);

  return (
    <ToolbarButton ref={ref} tooltip="Link" {...props} {...rest}>
      <Icons.link />
    </ToolbarButton>
  );
});
