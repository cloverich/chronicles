import React from "react";
import { Pane, Alert } from "evergreen-ui";

interface State {
  hasError: boolean;
  error: any;
}

export default class ErrorBoundary extends React.Component<any, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // You can also log the error to an error reporting service
    console.error("top level error boundary reached:", error, errorInfo);
  }

  renderError() {
    let errStr: string = "Unable to parse error for display. Check console? :|";
    let stack: string = "";
    try {
      if (this.state.error instanceof Error) {
        errStr = this.state.error.message;
        stack = this.state.error.stack || "";
      } else if (typeof this.state.error === "string") {
        errStr = this.state.error;
      } else {
        errStr = JSON.stringify(this.state.error, null, 2);
      }
      errStr = JSON.stringify(this.state.error, null, 2);
    } catch (err) {
      console.error(
        "Error parsing error to string in top-level Error boundary"
      );
    }

    return (
      <Pane padding={50}>
        <Alert intent="danger" title="Unhandled Error" overflow="auto">
          <p>There was an unhandled error that crashed the app</p>
          <pre>{errStr}</pre>
          <pre>{stack}</pre>
        </Alert>
      </Pane>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderError();
    }

    return this.props.children;
  }
}
