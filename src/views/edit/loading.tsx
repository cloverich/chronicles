import { observer } from "mobx-react-lite";
import React from "react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "../../components/IconButton";
import { Separator } from "../../components/Separator";
import Titlebar from "../../titlebar/macos";
import { ErrorContent } from "./EditorErrorBoundary";

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
          icon="chevron-left"
          className="drag-none mr-4"
          onClick={() => navigate(-1)}
          aria-label="Back to documents"
        />
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
