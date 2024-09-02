import { withRef } from "@udecode/cn";
import {
  useLinkToolbarButton,
  useLinkToolbarButtonState,
} from "@udecode/plate";
import React from "react";

import { LinkIcon } from "evergreen-ui";
import { ToolbarButton } from "../../components/Toolbar";

export const LinkToolbarButton = withRef<typeof ToolbarButton>((rest, ref) => {
  const state = useLinkToolbarButtonState();
  const { props } = useLinkToolbarButton(state);

  return (
    <ToolbarButton ref={ref} tooltip="Link" {...props} {...rest}>
      <LinkIcon size={16} />
    </ToolbarButton>
  );
});
