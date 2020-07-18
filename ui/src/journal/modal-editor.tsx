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
import { Node } from "slate";

interface EditProps {
  editing?: { journal: string; date?: string };
  setEditing: (args?: { journal: string; date?: string }) => any;
}

export type Props = EditProps & ContentState & Pick<JournalsState, "journals">;

export default function EditorWrapper(props: Props) {
  function editToday() {
    props.setEditing({
      journal: props.journals[0].name,
    });
  }

  if (props.editing) {
    return (
      <>
        <Button
          onClick={() => props.setEditing({ journal: props.journals[0].name })}
        >
          Add
        </Button>
        <ModalEditor {...props} editing={props.editing} />
      </>
    );
  } else {
    return (
      <Button
        onClick={() => props.setEditing({ journal: props.journals[0].name })}
      >
        Add
      </Button>
    );
  }
}

interface ModalEditor {
  editing: { journal: string; date?: string };
  setEditing: (args?: { journal: string; date?: string }) => any;
}

function ModalEditor(
  props: Pick<ContentState, "query" | "setQuery"> &
    Pick<JournalsState, "journals"> &
    ModalEditor
) {
  if (props.journals.length === 0) return null;

  const {
    value,
    setValue,
    isDirty,
    saveDocument,
    savingState,
    date,
    doc,
  } = useEditableDocument(props.editing.journal, props.editing.date);

  const [didSave, setDidSave] = useState(false);

  async function doConfirm(close: any) {
    await saveDocument();
    setDidSave(true);
    close();
  }

  function onCloseComplete() {
    // Unset editing state, which unmounts this component
    props.setEditing();

    if (didSave) {
      // hacky way to refresh the query, todo: mobx
      props.setQuery((query) => ({ ...query } as any));
    }
  }

  return (
    <>
      <Dialog
        minHeightContent="50vh"
        width="80vw"
        header={
          <DialogHeader
            journalNames={props.journals.map((j) => j.name)}
            selected={props.editing.journal}
            setSelected={(name: string) =>
              props.setEditing({ ...props.editing, journal: name })
            }
            date={date}
          />
        }
        title={props.journals[0].name + "-" + props.editing?.date}
        isShown={true}
        shouldCloseOnEscapePress={!isDirty}
        shouldCloseOnOverlayClick={!isDirty}
        onCloseComplete={onCloseComplete}
        preventBodyScrolling
        confirmLabel="save"
        isConfirmLoading={savingState.loading}
        isConfirmDisabled={doc.loading}
        onConfirm={doConfirm}
      >
        <Editor value={value} setValue={setValue} saving={false} />
      </Dialog>
    </>
  );
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
