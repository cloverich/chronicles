import React from "react";
import ErrorBoundary from "./error";
import Titlebar from "./titlebar/macos";
import * as Base from "./views/layout";

interface Props2 {
  children: any;
}

export default function Layout(props: Props2) {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen min-w-[480px] flex-col">
        {props.children}
      </div>
    </ErrorBoundary>
  );
}

export function LayoutDummy({ children }: any) {
  return (
    <ErrorBoundary>
      <Base.Container>
        <Titlebar className="pr-16"></Titlebar>
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>{children}</Base.ScrollContainer>
      </Base.Container>
    </ErrorBoundary>
  );
}
