import React, { useCallback, useState } from "react";
import { Dialog, toaster } from "evergreen-ui";
import { useEditableDocument } from "../../../hooks/documents";
import { Setter } from "../../../hooks/loadutils";
import Editor from "../../../views/editor/editor";
import DialogHeader from "./header";

// todo: move this type up its used everywhere
interface DocumentMetadata {
  journal: string;
  date?: string;
}

interface EditorWrapperProps {
  setEditing: (args?: DocumentMetadata) => any;
  onSaved: (didSave: boolean) => any;
  editing?: DocumentMetadata;
}

export default function EditorWrapper(props: EditorWrapperProps) {
  if (!props.editing) return null;

  return (
    <ModalEditor
      setEditing={props.setEditing}
      editing={props.editing}
      onSaved={props.onSaved}
    />
  );
}

interface ModalEditorProps {
  setEditing: (args?: DocumentMetadata) => any;
  onSaved: (didSave: boolean) => any;
  editing: DocumentMetadata;
}

function ModalEditor(props: ModalEditorProps) {
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

  const save = async (close: any) => {
    // TODO: Rather than exposing the exception, try the `useReaction` helper
    // and watching the documentsstore.error (or loading) property once it exists
    try {
      await saveDocument();
      setDidSave(true);
      close();
    } catch (err) {
      toaster.danger("Error saving document", { description: err.message });
    }
  };

  const onSaved = useCallback(() => {
    props.onSaved(didSave);
  }, [didSave]);

  return (
    <>
      <Dialog
        minHeightContent="50vh"
        width="80vw"
        header={<DialogHeader selected={props.editing.journal} date={date} />}
        isShown={true}
        shouldCloseOnEscapePress={!isDirty}
        shouldCloseOnOverlayClick={!isDirty}
        onCloseComplete={onSaved}
        preventBodyScrolling
        confirmLabel="save"
        isConfirmLoading={savingState.loading}
        isConfirmDisabled={doc.loading || !isDirty}
        onConfirm={save}
      >
        <Editor value={value} setValue={setValue} saving={false} />
      </Dialog>
    </>
  );
}
