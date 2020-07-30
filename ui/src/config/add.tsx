import React, { useState, useEffect, PropsWithChildren as P } from "react";
import { Dialog, Pane, TextInputField, Button, toaster } from "evergreen-ui";
import { IJournal } from "../client";
import { JournalsState } from "../hooks";
import Ajv, { ErrorObject } from "ajv";
import ky from "ky";

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "name",
      // https://github.com/prettier/prettier/issues/2789
      pattern: "^[\\w\\-._ ]+$",
    },
    url: {
      type: "string",
      title: "url",
      minLength: 1,
    },
  },
  required: ["name", "url"],
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

interface Props extends P<Pick<JournalsState, "adding" | "addJournal">> {
  directory: string;
  onClosed: () => any;
}

// Just wraps and prevents instantiating the <AddJournalDialog /> unless
// a non-empty directory is passed.
export default function AddJournalDialogWrapper(props: Props) {
  if (!props.directory.length) return null;

  return <AddJournalDialog {...props} />;
}

function AddJournalDialog(props: Props) {
  const { addJournal, adding } = props;

  // todo: windows
  // todo: parse with Browser compatible URL parser?
  const [formState, setState] = useState<IJournal>({
    // Pre-populate the journal name field using the directory
    // name. Did not think through validation much here
    name: props.directory.split("/").pop() || "",
    url: props.directory,
  });

  const [isShown, setIsShown] = useState(true);

  // todo: ugggh refactor this all
  async function submit(close: any) {
    const valid = validate(formState);
    if (!valid) {
      validate.errors &&
        validate.errors.forEach((err) => {
          toaster.danger(`${err.dataPath} - ${err.message}`);
        });
      return false;
    }

    try {
      await addJournal(formState, true);
      close();
    } catch (err) {
      toaster.danger(err.message);
    }
  }

  return (
    <>
      <Dialog
        minHeightContent="50vh"
        width="80vw"
        title="Add journal"
        isShown={isShown}
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
          formState={formState}
          setState={setState}
        />
      </Dialog>
    </>
  );
}

export function AddJournalForm(props: {
  saving: boolean;
  formState: any;
  setState: any;
}) {
  const { formState, setState } = props;

  return (
    <Pane backgroundColor="tint" margin={24}>
      <TextInputField
        label="Name"
        name="name"
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
