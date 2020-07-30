import React, { useState } from "react";
import { Button, Pane, Table, toaster } from "evergreen-ui";
import { IJournal } from "../client";
import { JournalsState } from "../hooks";
import AddJournal from "./add";
import ElectronDialog from "./dialog.electron";

export default function Config(props: JournalsState) {
  const { journals, loading, addJournal, adding } = props;
  const [directory, setDirectory] = useState<string>("");

  function onClosed() {
    setDirectory("");
  }

  function onSelectDirectory(directory: string) {
    setDirectory(directory);
  }

  async function removeJournal(journal: IJournal) {
    try {
      await props.removeJournal(journal);
      toaster.success(`Successfully removed ${journal.name}`);
    } catch (err) {
      toaster.danger(err);
    }
  }

  if (loading) {
    return <h1>LOADING</h1>;
  }

  return (
    <Pane margin={50}>
      <AddJournal
        addJournal={addJournal}
        adding={adding}
        directory={directory}
        onClosed={onClosed}
      />

      <Pane marginBottom={10} display="flex">
        <ElectronDialog onSelected={onSelectDirectory}>Add</ElectronDialog>
      </Pane>
      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>URL</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body height={240}>
          {journals.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell>{journal.url}</Table.TextCell>
              <Table.TextCell>
                <Button onClick={() => removeJournal(journal)}>Remove</Button>
              </Table.TextCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Pane>
  );
}
