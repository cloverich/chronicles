import React, { useState, useEffect, useContext } from "react";
import {
  Button,
  Pane,
  Table,
  toaster,
  Badge,
  Alert,
  TextInputField,
  Heading,
  Paragraph,
  IconButton,
  Tooltip,
} from "evergreen-ui";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { JournalResponse } from "../../preload/client/journals";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { RouteProps } from "react-router-dom";
import { Icons } from "../../components/icons";

// todo: TEST CASES
// create button is disabled by default and when no text is present
// create button cannot be doube clicked
// create button saves journal
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

  async function removeJournal(journal: JournalResponse) {
    if (confirm(`Are you sure you want to remove ${journal.name}?`)) {
      try {
        await store.remove(journal.id);
        toaster.success(`Successfully removed ${journal.name}`);
      } catch (err) {
        toaster.danger(`Error removing journal: ${String(err)}`);
      }
    }
  }

  async function setAsDefault(journal: JournalResponse) {
    try {
      await store.setDefault(journal.id);
    } catch (err) {
      toaster.danger(`Error setting journal as default: ${String(err)}`);
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
    <Pane width="100%">
      {renderError()}

      <Pane marginTop={24} marginBottom={24}>
        <Heading size={600}>Create a new journal</Heading>
        <Paragraph>
          Journals are like folders; all documents belong to a journal.
        </Paragraph>
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

      <hr />
      <h2>Active Journals</h2>
      <Paragraph>Take actions on existing journals below</Paragraph>

      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
          <Table.TextHeaderCell>Actions</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body>
          {store.active.map((journal) => {
            const isDefault = journal.id === store.defaultJournalId;
            return (
              <Table.Row key={journal.name}>
                <Table.TextCell>{journal.name}</Table.TextCell>
                <Table.TextCell>
                  <JournalArchiveButton journal={journal} />

                  <Tooltip
                    content="Delete the journal and all of its notes"
                    showDelay={1000}
                  >
                    <IconButton
                      size="small"
                      marginRight={12}
                      intent="danger"
                      onClick={() => removeJournal(journal)}
                      icon={<Icons.trash />}
                    />
                  </Tooltip>

                  <Tooltip
                    content="Set as default journal when creating new notes"
                    showDelay={1000}
                  >
                    <IconButton
                      size="small"
                      marginRight={12}
                      intent={isDefault ? "success" : "info"}
                      onClick={
                        isDefault ? () => {} : () => setAsDefault(journal)
                      }
                      icon={<Icons.star />}
                    />
                  </Tooltip>
                </Table.TextCell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>

      <h2>Archived Journals</h2>
      <Table>
        <Table.Head>
          <Table.TextHeaderCell>Name</Table.TextHeaderCell>
        </Table.Head>
        <Table.Body>
          {store.archived.map((journal) => (
            <Table.Row key={journal.name}>
              <Table.TextCell>{journal.name}</Table.TextCell>
              <Table.TextCell>
                <JournalArchiveButton journal={journal} />
                <IconButton
                  size="small"
                  marginRight={12}
                  intent="danger"
                  onClick={() => removeJournal(journal)}
                  icon={<Icons.trash />}
                />
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
        toaster.danger(
          "There was an error archiving the journal: " + String(err),
        );
      }
    }
  }

  return (
    <Tooltip
      content="(Un)Archive this journal (hide from default list of journals when creating new notes)"
      showDelay={1000}
    >
      <IconButton
        size="small"
        marginRight={12}
        onClick={() => toggleArchive(props.journal)}
        intent="info"
        icon={<Icons.archive />}
      />
    </Tooltip>
  );
}

export default observer(Journals);
