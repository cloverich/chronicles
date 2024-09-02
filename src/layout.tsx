import { Pane } from "evergreen-ui";
import React from "react";
import ErrorBoundary from "./error";

interface Props2 {
  children: any;
}

export default function Layout(props: Props2) {
  return (
    <ErrorBoundary>
      <Pane
        minWidth={480}
        minHeight="100vh"
        display="flex"
        flexDirection="column"
      >
        {props.children}
      </Pane>
    </ErrorBoundary>
  );
}

export function LayoutDummy({ children }: any) {
  return (
    <ErrorBoundary>
      <Pane minWidth={480}>
        <Pane borderBottom="default" elevation={1} padding={15} display="flex">
          <Pane marginRight={25}>
            <span className="mono" style={{ color: "#6E62B6" }}>
              chronicles
            </span>
          </Pane>
          <Pane flexGrow={1} marginRight={24}>
            <a href="">documents</a>
            <a href="">journals</a>
            <a href="">preferences</a>
          </Pane>
        </Pane>
        <Pane margin={50}>{children}</Pane>
      </Pane>
    </ErrorBoundary>
  );
}
