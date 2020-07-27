import React, { useState, PropsWithChildren as P } from "react";
import { remote } from "electron";
const { dialog } = remote;
import { Pane, TextInput, Button } from "evergreen-ui";

interface Props {
  onSelected: (directory: string) => any;
}

export default function ElectronDialog(props: P<Props>) {
  const [isSelecting, setSelecting] = useState<boolean>(false);

  async function openDialog() {
    if (isSelecting) return;

    setSelecting(true);
    try {
      const selected = await dialog.showOpenDialog(
        {
          title: "Select a directory",
          buttonLabel: "Use as journal",
          properties: ["openDirectory", "createDirectory"],
        },
      );

      if (selected.filePaths.length) {
        props.onSelected(selected.filePaths[0]);
      }
    } catch (err) {
      console.error(err);
    }
    setSelecting(false);
  }

  return (
    <Pane display="flex">
      <Button onClick={openDialog} label="Select directory">
        Add journal
      </Button>
    </Pane>
  );
}
