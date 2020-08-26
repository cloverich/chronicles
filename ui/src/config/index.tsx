import React, { useState } from "react";
import { Button, Pane, Table, toaster, Badge } from "evergreen-ui";
import { IJournal } from "../client";
import { useJournals } from "../hooks/journals";
import AddJournal from "./add";
import ElectronDialog from "./dialog.electron";
import { observer } from "mobx-react-lite";

function Config() {
  const store = useJournals();
  const [directory, setDirectory] = useState<string>("");

  function onClosed() {
    setDirectory("");
  }

  function onSelectDirectory(directory: string) {
    setDirectory(directory);
  }

  async function removeJournal(journal: IJournal) {
    try {
      await store.remove(journal);
      toaster.success(`Successfully removed ${journal.name}`);
    } catch (err) {
      toaster.danger(err);
    }
  }

  return (
    <Pane margin={50}>
      <AddJournal
        addJournal={store.add}
        saving={store.saving}
        directory={directory}
        onClosed={onClosed}
      />

      <Pane marginBottom={10} display="flex">
        <ElectronDialog onSelected={onSelectDirectory}>Add</ElectronDialog>
      </Pane>
      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>Unit</Table.TextHeaderCell>
          <Table.TextHeaderCell>URL</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body height={240}>
          {store.journals.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell style={{ textAlign: "center" }}>
                <Badge>{journal.unit}</Badge>
              </Table.TextCell>
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

export default observer(Config);
