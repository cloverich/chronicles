import React, { useState, useEffect, useContext } from "react";
import {
  Button,
  Pane,
  Table,
  toaster,
  Badge,
  Alert,
  TextInputField,
} from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalResponse } from "../../preload/client/journals";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { RouteProps } from "react-router-dom";

// todo: TEST CASES
// button is disabled by default and when no text is present
// button cannot be doube clicked
// button saves journal
// errors are displayed
// journal added after successful save
// journals load and are displayed
function Journals(props: RouteProps) {
  const store = useContext(JournalsStoreContext)!;
  const [name, setName] = useState<string>("");

  function save() {
    store.create({ name });
  }

  // Reset text box after a successful save
  useEffect(() => {
    // This works but feels all kinds of absurd.
    return autorun(() => {
      if (!store.saving && !store.error) setName("");
    });
  }, []);

  // Load journals on mount
  // todo: The app load itself should handle this
  useEffect(() => {
    store.load();
  });

  async function removeJournal(journal: JournalResponse) {
    if (confirm(`Are you sure you want to remove ${journal.name}?`)) {
      try {
        await store.remove(journal.id);
        toaster.success(`Successfully removed ${journal.name}`);
      } catch (err) {
        toaster.danger(err as any);
      }
    }
  }

  function renderError() {
    if (store.error)
      return (
        <Alert intent="danger" title="Error saving journal">
          {JSON.stringify(store.error)}
        </Alert>
      );

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
        >
          Create new journal
        </Button>
      </Pane>

      <h2>Active Journals</h2>
      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>Id</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body>
          {store.active.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell style={{ textAlign: "center" }}>
                <Badge>{journal.id}</Badge>
              </Table.TextCell>
              <Table.TextCell>
                <JournalArchiveButton journal={journal} />
                <Button
                  size="small"
                  marginRight={12}
                  intent="danger"
                  onClick={() => removeJournal(journal)}
                >
                  Remove
                </Button>
              </Table.TextCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <h2>Archived Journals</h2>
      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>Id</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body>
          {store.archived.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell style={{ textAlign: "center" }}>
                <Badge>{journal.id}</Badge>
              </Table.TextCell>
              <Table.TextCell>
                <JournalArchiveButton journal={journal} />
                <Button
                  size="small"
                  marginRight={12}
                  intent="danger"
                  onClick={() => removeJournal(journal)}
                >
                  Remove
                </Button>
              </Table.TextCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Pane>
  );
}

/**
 * UI and hook for toggling archive state on a journal
 */
function JournalArchiveButton(props: { journal: JournalResponse }) {
  const store = useContext(JournalsStoreContext)!;

  async function toggleArchive(journal: JournalResponse) {
    const isArchiving = !!journal.archivedAt;
    const archiveAction = isArchiving ? "archive" : "restore";

    if (confirm(`Are you sure you want to ${archiveAction} ${journal.name}?`)) {
      try {
        await store.toggleArchive(journal);
        if (isArchiving) {
          toaster.success(`Successfully archived ${journal.name}`);
        } else {
          toaster.success(`Successfully restored ${journal.name}`);
        }
      } catch (err) {
        console.error(err);
        toaster.danger("There was an error archiving the journal");
      }
    }
  }

  if (props.journal.archivedAt) {
    return (
      <Button
        size="small"
        marginRight={12}
        onClick={() => toggleArchive(props.journal)}
      >
        Restore
      </Button>
    );
  } else {
    return (
      <Button
        size="small"
        marginRight={12}
        onClick={() => toggleArchive(props.journal)}
      >
        Archive
      </Button>
    );
  }
}

export default observer(Journals);
