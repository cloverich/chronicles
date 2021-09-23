import React, { PropsWithChildren } from "react";
import { Pane, Tablist, Tab, Text, Icon } from "evergreen-ui";

type View = 'journals' | 'documents' | 'preferences';

interface Props {
  selected?: View;
  setSelected: React.Dispatch<React.SetStateAction<any>>;
}

const monoStyle = {
  fontFamily: "IBM Plex Mono",
};

export default function Layout(props: PropsWithChildren<Props>) {

  // todo: optimize
  const tabs = (['journals', 'documents', 'preferences'] as View[]).map((tab) => {
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
        <Tablist flexGrow={1} marginRight={24}>
          {tabs}
        </Tablist>
      </Pane>
      <Pane margin={50}>{props.children}</Pane>
    </Pane>
  );
}
