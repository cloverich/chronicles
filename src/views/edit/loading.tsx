import { ChevronLeftIcon, IconButton } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import { useNavigate } from "react-router-dom";
import Titlebar from "../../titlebar/macos";
import { ErrorContent } from "./EditorErrorBoundary";
import { Separator } from "./editor/components/Separator";

export interface LoadingComponentProps {
  error?: Error | null;
  documentId?: string;
  journal?: string;
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
          onClick={() => navigate(-1)}
          marginRight={8}
        >
          Back to documents
        </IconButton>
        <Separator orientation="vertical" />
      </Titlebar>
      {props.error && (
        <ErrorContent
          error={props.error}
          journal={props.journal}
          documentId={props.documentId}
        />
      )}
    </>
  );
});
