import React, { PropsWithChildren } from "react";
import { Pane } from "evergreen-ui";
import { NavLink, useLocation } from "react-router-dom";
import "./styles.css";

interface Props2 extends PropsWithChildren {}

export default function Titlebar({ children }: Props2) {
  const location = useLocation();

  return (
    <div className="TitleBar-macos">
      {children}
      {/* <Pane marginRight={25}>
        <span className="mono" style={{ color: "#6E62B6" }}>
          chronicles
        </span>
      </Pane>
      <Pane flexGrow={1} marginRight={24}>

      </Pane> */}
    </div>
  );
}
