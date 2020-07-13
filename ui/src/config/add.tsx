import React, { useState } from "react";
import { Dialog, Pane, TextInputField, Button } from "evergreen-ui";
import client, { IJournal } from "../client";
import { JournalsState } from "../hooks";

export default function AddJournal(
  props: Pick<JournalsState, "adding" | "addJournal"> & {
    isShown: boolean;
    onClosed: () => any;
  }
) {
  const { addJournal, adding } = props;
  const [formState, setState] = useState<IJournal>({
    name: "",
    url: "",
  });

  async function submit(close: any) {
    await addJournal(formState);
    close();
  }

  return (
    <>
      <Dialog
        minHeightContent="50vh"
        width="80vw"
        title="Add journal"
        isShown={props.isShown}
        shouldCloseOnEscapePress={!adding}
        shouldCloseOnOverlayClick={!adding}
        preventBodyScrolling
        confirmLabel="save"
        isConfirmLoading={adding}
        isConfirmDisabled={!formState.name || !formState.url}
        onConfirm={submit}
        onCloseComplete={props.onClosed}
      >
        <AddJournalForm
          saving={adding}
          submit={submit}
          formState={formState}
          setState={setState}
        />
      </Dialog>
    </>
  );
}

export function AddJournalForm(props: {
  saving: boolean;
  submit: any;
  formState: any;
  setState: any;
}) {
  const { formState, setState, submit } = props;

  return (
    <Pane backgroundColor="tint" margin={24}>
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
    </Pane>
  );
}
