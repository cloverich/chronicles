import React, { useState, useEffect } from "react";
import { Button, Pane, Text, TextInputField, Table } from "evergreen-ui";
import client, { IJournal } from "../client";
import { JournalsState } from "../hooks";
import AddJournal from "./add";

export default function Config(props: JournalsState) {
  const { journals, loading, addJournal, adding } = props;
  const [showAddModal, setShowAddModal] = useState(false);

  function onClosed() {
    setShowAddModal(false);
  }

  if (loading) {
    return <h1>LOADING</h1>;
  }

  return (
    <Pane margin={50}>
      <AddJournal
        addJournal={addJournal}
        adding={adding}
        isShown={showAddModal}
        onClosed={onClosed}
      />

      <Pane marginBottom={10} display="flex">
        <Button onClick={() => setShowAddModal(!showAddModal)}>Add</Button>
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
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Pane>
  );
}
