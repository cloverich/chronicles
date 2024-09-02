import { ChevronLeftIcon, IconButton, Pane } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import { useNavigate } from "react-router-dom";
import Titlebar from "../../titlebar/macos";
import { Separator } from "./editor/components/Separator";

export interface LoadingComponentProps {
  error?: Error | null;
}

export const placeholderDate = new Date().toISOString().slice(0, 10);
export const noop: any = () => {};

export const EditLoadingComponent = observer((props: LoadingComponentProps) => {
  const navigate = useNavigate();

  return (
    <>
      <Titlebar>
        <IconButton
          backgroundColor="transparent"
          border="none"
          icon={ChevronLeftIcon}
          className="drag-none"
          onClick={() => {}}
          marginRight={8}
        >
          Back to documents
        </IconButton>
        <Separator orientation="vertical" />
      </Titlebar>
      <Pane padding={50} paddingTop={98} flexGrow={1} display="flex">
        <Pane flexGrow={1} display="flex" flexDirection="column" width="100%">
          <Pane flexGrow={1} paddingTop={24}></Pane>
        </Pane>
      </Pane>
    </>
  );
});
