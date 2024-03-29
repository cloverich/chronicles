import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Editor from "./editor";
import {
  Pane,
  Button,
  Popover,
  Menu,
  Position,
  Tab,
  Tablist,
} from "evergreen-ui";
import { useEditableDocument } from "./useEditableDocument";
import { EditableDocument } from "./EditableDocument";
import { css } from "emotion";
import { JournalResponse } from "../../preload/client/journals";
import { EditLoadingComponent } from "./loading";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useIsMounted } from "../../hooks/useIsMounted";
import { JournalsStoreContext } from "../../hooks/useJournalsLoader";
import { useParams, useNavigate } from "react-router-dom";
import { SearchStoreContext } from "../documents/SearchStore";

// Loads document, with loading and error placeholders
function DocumentLoadingContainer() {
  const journalsStore = useContext(JournalsStoreContext);
  const searchStore = useContext(SearchStoreContext);
  const { document: documentId } = useParams();

  const { document, loadingError } = useEditableDocument(
    searchStore,
    journalsStore,
    documentId,
  );

  // Filter journals to non-archived ones, but must also add
  // the current document's journal if its archived
  const [journals, setJournals] = useState<any>();
  useEffect(() => {
    if (!document) return;

    const journals = journalsStore.journals.filter((j) => {
      if (j.archivedAt) {
        return j.id === document.journalId;
      } else {
        return !j.archivedAt;
      }
    });

    setJournals(journals);
  }, [document, loadingError]);

  if (loadingError) {
    return <EditLoadingComponent error={loadingError} />;
  }

  if (!document || !journals) {
    return <EditLoadingComponent />;
  }

  return <DocumentEditView document={document} journals={journals} />;
}

interface DocumentEditProps {
  document: EditableDocument;
  journals: JournalResponse[];
}

const DocumentEditView = observer((props: DocumentEditProps) => {
  const { document, journals } = props;
  const isMounted = useIsMounted();
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [tabs] = React.useState(["Editor", "Slate Nodes", "Markdown", "MDAST"]);

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
    [],
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
            border-bottom: 1px solid #8d8d8d;
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
            border-bottom: 1px solid #8d8d8d;
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
        "Document is unsaved, exiting will discard document. Stop editing anyways?",
      )
    ) {
      navigate(-1);
    }
  }

  async function deleteDocument() {
    if (!document.canDelete) return;
    if (confirm("Are you sure?")) {
      await document.del();
      if (isMounted()) navigate(-1);
    }
  }

  function renderTab(tab: string) {
    switch (tab) {
      case "Editor":
        return (
          <Pane>
            <Editor
              saving={document.saving}
              value={document.slateContent}
              setValue={document.setSlateContent}
            />
          </Pane>
        );
      case "Slate Nodes":
        return <pre> {JSON.stringify(document.slateContent, null, 2)}</pre>;
      case "Markdown":
        return <pre>{document.content}</pre>;
      case "MDAST":
        return <pre>{JSON.stringify(document.mdastDebug, null, 2)}</pre>;
    }
  }

  // flexGrows are needed so save / edit buttons are at bottom on both empty documents
  // and scrollable documents
  return (
    <Pane flexGrow={1} display="flex" flexDirection="column">
      <div style={{ marginBottom: "24px" }}>
        <a
          onClick={goBack}
          className={css`
            cursor: pointer;
          `}
        >
          Back
        </a>
      </div>

      <div>
        <input
          type="text"
          name="title"
          ref={onInputRendered}
          className={css`
            font-size: 1.8em;
            border: none;
            width: 100%;
            &:focus {
              outline: none;
            }
          `}
          onChange={(e: any) => (document.title = e.target.value)}
          value={document.title || ""} // OR '' prevents react complaining about uncontrolled component
          placeholder="Untitled document"
        />
      </div>
      <div
        className={css`
          display: flex;
          justify-content: flex-start;
          padding-left: 2px;
          font-size: 0.9rem;
          margin-top: -4px;
          margin-bottom: 16px;
        `}
      >
        {datePicker()}
        &nbsp;in&nbsp;
        {journalPicker()}
      </div>

      <Pane flexGrow={1}>
        <Tablist marginBottom={16} flexBasis={240} marginRight={24}>
          {tabs.map((tab, index) => (
            <Tab
              aria-controls={`panel-${tab}`}
              isSelected={index === selectedIndex}
              key={tab}
              onSelect={() => setSelectedIndex(index)}
            >
              {tab}
            </Tab>
          ))}
        </Tablist>
        {renderTab(tabs[selectedIndex])}
      </Pane>

      {/* Action buttons */}
      <Pane marginTop={24} display="flex" justifyContent="flex-end">
        <Button
          onClick={() => document.save()}
          disabled={!document.dirty}
          isLoading={document.saving}
        >
          {document.saving ? "Saving" : document.dirty ? "Save" : "Saved"}
        </Button>
        <Button
          marginLeft={16}
          onClick={deleteDocument}
          disabled={!document.canDelete}
        >
          Delete
        </Button>
      </Pane>
    </Pane>
  );
});

export default observer(DocumentLoadingContainer);
