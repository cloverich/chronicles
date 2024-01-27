import React from "react";
import { withRef } from "@udecode/cn";
import {
  useMarkToolbarButton,
  useMarkToolbarButtonState,
  useLinkToolbarButton,
  useLinkToolbarButtonState,
} from "@udecode/plate";

import { ToolbarButton } from "../components/Toolbar";
import { Icons } from "../../../../components/icons";

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

export const LinkToolbarButton = withRef<typeof ToolbarButton>((rest, ref) => {
  const state = useLinkToolbarButtonState();
  const { props } = useLinkToolbarButton(state);

  return (
    <ToolbarButton ref={ref} tooltip="Link" {...props} {...rest}>
      <Icons.link />
    </ToolbarButton>
  );
});
