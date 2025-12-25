import React from "react";
import { NavigateFunction } from "react-router-dom";
import { Alert } from "../../components";
import { IconButton } from "../../components/IconButton";
import Titlebar from "../../titlebar/macos";
import * as Base from "../layout";
import { Separator } from "./editor/components/Separator";

interface State {
  hasError: boolean;
  error: any;
}

interface Props {
  children: React.ReactNode;
  navigate: NavigateFunction;
  documentId: string;
  journal: string;
}

/**
 * Wraps the editor in an error boundary that catches and displays errors in an editor-friendly way.
 */
export default class EditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(
      "EditorErrorBoundary error boundary reached:",
      error,
      errorInfo,
    );
  }

  renderError() {
    const { errStr, stack } = decomposeError(this.state.error);

    return (
      <Base.EditorContainer>
        <Titlebar>
          <IconButton
            icon="chevron-left"
            className="drag-none mr-4"
            onClick={() => this.props.navigate("/documents")}
            aria-label="Back to documents"
          />
          <Separator orientation="vertical" />
        </Titlebar>

        {/* This Ghost div is same height as titlebar, so pushes the main content below it -- necessary for the contents scrollbar to make sense */}
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>
          <ErrorContent
            error={this.state.error}
            journal={this.props.journal}
            documentId={this.props.documentId}
          />
        </Base.ScrollContainer>
      </Base.EditorContainer>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderError();
    }

    return this.props.children;
  }
}

export function decomposeError(error: any) {
  let errStr: string = "Unable to parse error for display. Check console? :|";
  let stack: string = "";
  try {
    if (error instanceof Error) {
      errStr = error.message;
      stack = error.stack || "";
    } else if (typeof error === "string") {
      errStr = error;
    } else {
      errStr = JSON.stringify(error, null, 2);
    }
    errStr = JSON.stringify(error, null, 2);
  } catch (err) {
    console.error("Error parsing error to string in top-level Error boundary");
  }

  return { errStr, stack };
}

export function ErrorContent({
  error,
  journal,
  documentId,
}: {
  error: any;
  journal?: string;
  documentId?: string;
}) {
  const { errStr, stack } = decomposeError(error);

  return (
    <Alert.Alert
      variant="error"
      title="Unhandled Error"
      className="overflow-x-auto"
    >
      <div>
        <p>There was an error that crashed the editor</p>
        {documentId && (
          <p>
            <span className="font-medium">Offending document:</span>{" "}
            {journal || "Unknown Journal"}/{documentId}
            .md
          </p>
        )}
        {errStr && errStr != "{}" && <pre>{errStr}</pre>}
        <pre>{stack}</pre>
      </div>
    </Alert.Alert>
  );
}
