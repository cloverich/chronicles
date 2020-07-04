import React, { useState, ComponentProps, PropsWithChildren } from "react";
import { Pane, Tablist, Tab } from "evergreen-ui";

interface Props<T> {
  tabs: T[];
  selected: T;
  setSelected: (tab: T) => any;
}

export default function Layout<T>(props: PropsWithChildren<Props<T>>) {
  const tabs = props.tabs.map((tab) => {
    return (
      <Tab
        key={tab as any}
        onSelect={() => props.setSelected(tab)}
        isSelected={props.selected === tab}
        aria-controls={`panel-${tab}`}
      >
        {tab}
      </Tab>
    );
  });

  return (
    <Pane>
      <Tablist marginBottom={16} flexBasis={240} marginRight={24}>
        {tabs}
      </Tablist>
      {props.children}
    </Pane>
  );
}
