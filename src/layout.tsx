import React, { PropsWithChildren } from "react";
import { Pane, Tablist, Tab, Text, Icon } from "evergreen-ui";

interface Props<T> {
  tabs: T[];
  selected?: T;
  setSelected: React.Dispatch<React.SetStateAction<T>>;
}

const monoStyle = {
  fontFamily: "IBM Plex Mono",
};

// todo: Why did I make this generic?
export default function Layout<T>(props: PropsWithChildren<Props<T>>) {
  // todo: optimize
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
      <Pane borderBottom="default" elevation={1} padding={15} display="flex">
        <Pane marginRight={25}>
          <span style={monoStyle}>#</span>
          <span style={monoStyle}>chronicles</span>
        </Pane>
        <Tablist flexBasis={240} marginRight={24}>
          {tabs}
        </Tablist>
      </Pane>
      <Pane margin={50}>{props.children}</Pane>
    </Pane>
  );
}
