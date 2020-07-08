import React, { useContext, useState } from "react";
import Search from "./search";
import {
  Button,
  Menu,
  Popover,
  Position,
  toaster,
  Pane,
  Dialog,
  Badge,
} from "evergreen-ui";
import { ContentState, JournalsState, useEditableDocument } from "../hooks";
import Editor, { Props as EditorProps } from "./editor";

// Search and Add and...
export default function DocsListHeader(
  props: ContentState & Pick<JournalsState, "journals">
) {
  if (props.journals.length === 0) return null;
  const [isShown, setShown] = useState(false);
  const [selected, setSelected] = useState(props.journals[0].name);

  const {
    value,
    setValue,
    date,
    saveDocument,
    savingState,
    loading,
  } = useEditableDocument(selected, isShown);

  async function doConfirm(close: any) {
    await saveDocument();

    // hacky way to refresh the query
    props.setQuery((query) => ({ ...query } as any));
    close();
  }

  return (
    <>
      <Button onClick={() => setShown(true)}>Add</Button>
      <Dialog
        minHeightContent="50vh"
        width="80vw"
        header={
          <DialogHeader
            journalNames={props.journals.map((j) => j.name)}
            selected={selected}
            setSelected={setSelected}
            date={date}
          />
        }
        title={props.journals[0].name + "-" + date}
        isShown={isShown}
        onCloseComplete={() => setShown(false)}
        preventBodyScrolling
        confirmLabel="save"
        isConfirmLoading={savingState.loading}
        isConfirmDisabled={loading}
        onConfirm={doConfirm}
      >
        <Editor value={value} setValue={setValue} saving={false} />
      </Dialog>
    </>
  );

  // for each journal, see if there is rorom for a new entry today
  // Then, for each of those offer to add one here
  // Once it appears, only actually send it if content is added
  // otherrwise clear and forget it
}

interface DialogHeaderProps {
  selected: string;
  setSelected: (s: string) => any;
  journalNames: string[];
  date: string;
}

function DialogHeader(props: DialogHeaderProps) {
  const menuItems = props.journalNames.map((journalName) => {
    return (
      <Menu.Item
        key={journalName}
        onSelect={() => props.setSelected(journalName)}
      >
        {journalName}
      </Menu.Item>
    );
  });

  return (
    <>
      <Popover
        position={Position.BOTTOM_LEFT}
        content={
          <Menu>
            <Menu.Group>{menuItems}</Menu.Group>
          </Menu>
        }
      >
        <Button marginRight={16}>{props.selected}</Button>
      </Popover>
      <Badge>{props.date}</Badge>
    </>
  );
}

function AddOneButton() {
  return <Button>Add</Button>;
}
