import React, { useState, useEffect, useContext } from "react";
import { Button, Pane, Table, toaster, Badge, Alert, TextInputField } from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalResponse } from '../../preload/client/journals';
import { autorun } from 'mobx'
import { observer } from "mobx-react-lite";

// todo: TEST CASES
// button is disabled by default and when no text is present
// button cannot be doube clicked
// button saves journal
// errors are displayed
// journal added after successful save
// journals load and are displayed
function Journals() {
  const store = useContext(JournalsStoreContext);
  const [name, setName] = useState<string>("");

  function save() {
    store.create({ name });
  }

  // Reset text box after a successful save
  useEffect(() => {
    // This works but feels all kinds of absurd. 
    return autorun(() => {
      if (!store.saving && !store.error) setName('')
    })
  }, [])

  // Load journals on mount
  // todo: The app load itself should handle this
  useEffect(() => {
    store.load();
  })

  async function removeJournal(journal: JournalResponse) {
    try {
      await store.remove(journal.id);
      toaster.success(`Successfully removed ${journal.name}`);
    } catch (err) {
      toaster.danger(err);
    }
  }

  function renderError() {
    if (store.error) return (
      <Alert intent="danger" 
        title="Error saving journal"
      >
        {JSON.stringify(store.error)}
      </Alert>
    )

    return null;
  }

  return (
    <Pane>
      {renderError()}

      <Pane marginTop={24} marginBottom={24}>
        <TextInputField
          label="Name"
          name="name"
          hint="Must be unique"
          placeholder="A short display name for the journal"
          onChange={(e: any) => setName(e.target.value)}
          value={name}
          />
        <Button
          isLoading={store.saving}
          disabled={name.trim().length === 0}
          // disabled={}
          onClick={save}
          >Create new journal</Button>
      </Pane>

      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>Id</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body>
          {store.journals.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell style={{ textAlign: "center" }}>
                <Badge>{journal.id}</Badge>
              </Table.TextCell>
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

export default observer(Journals);
