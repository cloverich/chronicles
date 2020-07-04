import React, { useState, useEffect } from "react";
import { Button, Pane, Text, TextInputField, FilePicker } from "evergreen-ui";
import client, { IJournal } from "../client";
import { JournalsState } from "../hooks";

export default function Journals(props: JournalsState) {
  const { journals, loading, addJournal: addJournals, adding } = props;

  if (loading) {
    return <h1>LOADING</h1>;
  }

  const panes = journals.map((j) => {
    return (
      <Pane
        key={j.name}
        elevation={1}
        backgroundColor="white"
        height={120}
        margin={24}
        display="flex"
        justifyContent="center"
        alignItems="center"
        flexDirection="column"
      >
        <Text>{j.name}</Text>
        <Text size={300}>{j.url}</Text>
      </Pane>
    );
  });

  return (
    <>
      {panes}
      <AddJournalForm add={addJournals} saving={adding} />
    </>
  );
}

export function AddJournalForm(props: {
  saving: boolean;
  add: (j: IJournal) => any;
}) {
  const [formState, setState] = useState<IJournal>({
    name: "",
    url: "",
  });

  function submit() {
    props.add(formState);
  }
  return (
    <Pane
      elevation={2}
      backgroundColor="white"
      margin={24}
      display="flex"
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      <TextInputField
        label="Name"
        name={"name"}
        hint="Must be unique"
        placeholder="A short display name for the journal"
        onChange={(e: any) => setState({ ...formState, name: e.target.value })}
        value={formState.name}
      />
      <TextInputField
        label="URL"
        hint="File path to journal"
        onChange={(e: any) => setState({ ...formState, url: e.target.value })}
        value={formState.url}
        placeholder="Journal URL"
      />
      <Button
        marginRight={16}
        appearance="primary"
        onClick={submit}
        disabled={props.saving}
      >
        Add
      </Button>
    </Pane>
  );
}
