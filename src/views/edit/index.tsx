import { ViewState } from "../../container";
import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import Editor from "./editor";
import { Pane, Button, Popover, Menu, Position } from "evergreen-ui";
import { useEditableDocument, EditableDocument } from "./useEditableDocument";
import { css } from "emotion";
import { JournalResponse } from "../../preload/client/journals";
import { EditLoadingComponent } from "./loading";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useIsMounted } from "../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import Toolbar from "./toolbar";

interface EditDocumentProps {
  documentId?: string;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
}

// Loads document, with loading and error placeholders
function DocumentLoadingContainer(props: EditDocumentProps) {
  const journals = useContext(JournalsStoreContext);
  const { document, loadingError } = useEditableDocument(
    journals.journals,
    props.documentId
  );

  if (loadingError) {
    return (
      <EditLoadingComponent setView={props.setView} error={loadingError} />
    );
  }

  if (!document) {
    return <EditLoadingComponent setView={props.setView} />;
  }

  return (
    <DocumentEditView
      document={document}
      journals={journals.journals}
      setView={props.setView}
    />
  );
}

interface DocumentEditProps {
  document: EditableDocument;
  journals: JournalResponse[];
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
}

const DocumentEditView = observer((props: DocumentEditProps) => {
  const { document, journals } = props;
  const isMounted = useIsMounted();

  // Autofocus the heading input
  const onInputRendered = React.useCallback(
    (inputElement: HTMLInputElement) => {
      if (inputElement) {
        // After experimenting, unsure why the delay is helpful.
        // https://blog.maisie.ink/react-ref-autofocus/
        setTimeout(() => inputElement.focus(), 200);
        inputElement.focus();
      }
    },
    []
  );

  function getName(journalId?: string) {
    const journal = journals?.find((j) => j.id === journalId);
    return journal ? journal.name : "Unknown journal";
  }

  function makeOptions(close: any) {
    return journals.map((j: any) => {
      return (
        <Menu.Item
          key={j.id}
          onSelect={(e) => {
            document.journalId = j.id;
            close();
          }}
        >
          {j.name}
        </Menu.Item>
      );
    });
  }

  function journalPicker() {
    return (
      <Popover
        position={Position.BOTTOM}
        content={({ close }) => (
          <div
            className={css`
              max-height: 400px;
              overflow: auto;
            `}
          >
            <Menu>
              <Menu.Group>{makeOptions(close)}</Menu.Group>
            </Menu>
          </div>
        )}
      >
        <span
          className={css`
            border-bottom: 1px dotted purple;
            line-height: 1.3rem;
            cursor: pointer;
          `}
        >
          {getName(document.journalId)}
        </span>
      </Popover>
    );
  }

  function onDayPick(day: Date, callback: () => void) {
    document.createdAt = day.toISOString();
    callback();
  }

  // tests: when changing date, documents date is highlighted
  // when changing date, currently selected date's month is the active one
  // document auto-saves when changing date
  function datePicker() {
    return (
      <Popover
        position={Position.BOTTOM}
        content={({ close }) => (
          <div
            className={css`
              max-height: 400px;
              overflow: auto;
            `}
          >
            <DayPicker
              selected={new Date(document.createdAt)}
              defaultMonth={new Date(document.createdAt)}
              onDayClick={(day) => onDayPick(day, close)}
              mode="single"
            />
          </div>
        )}
      >
        <span
          className={css`
            border-bottom: 1px dotted purple;
            line-height: 1.3rem;
            cursor: pointer;
          `}
        >
          {document.createdAt.slice(0, 10)}
        </span>
      </Popover>
    );
  }

  function goBack() {
    if (
      !document.dirty ||
      confirm(
        "Document is unsaved, exiting will discard document. Stop editing anyways?"
      )
    ) {
      props.setView("documents");
    }
  }

  async function deleteDocument() {
    if (!document.canDelete) return;
    if (confirm("Are you sure?")) {
      await document.del();
      if (isMounted()) props.setView("documents");
    }
  }

  return (
    <Pane>
      <a
        onClick={goBack}
        className={css`
          cursor: pointer;
        `}
      >
        Back
      </a>
      <Pane marginTop={24}>
        <div
          className={css`
            display: flex;
            justify-content: flex-start;
          `}
        >
          {datePicker()}
          &nbsp;/&nbsp;
          {journalPicker()}
        </div>
        <div
          className={css`
            margin-bottom: 16px;
            margin-top: 16px;
          `}
        >
          <input
            type="text"
            name="title"
            ref={onInputRendered}
            className={css`
              font-size: 1.5em;
              border: none;
              width: 100%;
              &:focus {
                outline: none;
              }
            `}
            onChange={(e: any) => (document.title = e.target.value)}
            value={document.title || ""} // OR '' prevents react complaining about uncontrolled component
            placeholder="Untitled"
          />
        </div>
        <div>
          <Toolbar />
        </div>

        {/* note: its not actually clear to me whether toJS is necessary here. */}
        <Editor
          saving={document.saving}
          value={document.slateContent}
          setValue={document.setSlateContent}
        />

        <Pane marginTop={24}>
          <Button
            marginRight={16}
            onClick={() => document.save()}
            disabled={!document.dirty}
            isLoading={document.saving}
          >
            {document.saving ? "Saving" : document.dirty ? "Save" : "Saved"}
          </Button>
          <Button onClick={deleteDocument} disabled={!document.canDelete}>
            Delete
          </Button>
        </Pane>
      </Pane>
    </Pane>
  );
});

export default observer(DocumentLoadingContainer);
