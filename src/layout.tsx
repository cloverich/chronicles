import React, { PropsWithChildren } from "react";
import { Pane, Tablist, Tab } from "evergreen-ui";
import ErrorBoundary from "./error";
import { NavLink, useLocation } from "react-router-dom";

interface Props2 {
  children: any;
}

function classnameFunc({ isActive }: any) {
  return isActive ? "link-active" : "link-inactive";
}

export default function Layout(props: Props2) {
  // I was too lazy to have each top-level route wrap itself in the right
  // layout, since only the edit view(s) don't use the normal layout
  // hence we have this hack here. What could go wrong?
  const location = useLocation();
  if (location.pathname.startsWith("/edit")) {
    return (
      <Pane
        padding={50}
        display="flex"
        flexDirection="column"
        minHeight="100vh"
      >
        {props.children}
      </Pane>
    );
  }

  return (
    <ErrorBoundary>
      <Pane
        minWidth={480}
        minHeight="100vh"
        display="flex"
        flexDirection="column"
      >
        <Pane borderBottom="default" elevation={1} padding={15} display="flex">
          <Pane marginRight={25}>
            <span className="mono" style={{ color: "#6E62B6" }}>
              chronicles
            </span>
          </Pane>
          <Pane flexGrow={1} marginRight={24}>
            <NavLink to="documents" className={classnameFunc}>
              documents
            </NavLink>
            <NavLink to="preferences" className={classnameFunc}>
              preferences
            </NavLink>
          </Pane>
        </Pane>
        <Pane padding={50} flexGrow={1} display="flex">
          {props.children}
        </Pane>
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
