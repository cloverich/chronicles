import React from "react";
import { Pane, Badge, Button, Heading } from "evergreen-ui";

interface HeaderProps {
  date: string;
  journal: string;
  setEditing: (args: { journal: string; date: string }) => any;
}

export function Header(props: HeaderProps) {
  function setEditing() {
    props.setEditing({ journal: props.journal, date: props.date });
  }

  return (
    <Pane display="flex" flexDirection="column" width={400}>
      <Heading fontFamily="IBM Plex Mono">
        <Badge color="neutral" fontFamily="IBM Plex Mono">
          /{props.date}/{props.journal}
        </Badge>

        <Button
          fontFamily="IBM Plex Mono"
          onClick={setEditing}
          appearance="minimal"
        >
          Edit
        </Button>
      </Heading>
    </Pane>
  );
}
