import { ViewState } from '../../container';
import React, { ComponentPropsWithRef} from 'react';
import { observer } from 'mobx-react-lite';
import Editor from './editor/editor';
import { Pane, Button,Popover, Menu, Position } from 'evergreen-ui';
import { useEditableDocument, useJournals, EditableDocument } from './useEditableDocument';
import { css } from 'emotion';
import { JournalResponse } from "../../api/client/journals";
import { toJS } from 'mobx';
import { EditLoadingComponent } from './loading';


interface Props extends React.PropsWithChildren<{}> {
  documentId?: string;
  // todo: use this to set the default journal on new documents
  // journalId?: string;
  setView: React.Dispatch<React.SetStateAction<ViewState>>
}

// Loads journals, with loading and error placeholders
// todo: move to a higher level after refactoring and removing legacy useJournals code
function JournalsLoadingContainer(props: Props) {
  const { journals, loadingError } = useJournals();

  if (loadingError) {
    return (
      <EditLoadingComponent setView={props.setView} error={loadingError} />
      )
  }

  if (!journals) {
    return <EditLoadingComponent setView={props.setView} />
  }

  return <DocumentLoadingContainer journals={journals} documentId={props.documentId} setView={props.setView} />
}

interface EditDocumentProps {
  journals: JournalResponse[];
  documentId?: string;
  setView: React.Dispatch<React.SetStateAction<ViewState>>
}

// Loads document, with loading and error placeholders
function DocumentLoadingContainer(props: EditDocumentProps) {

  const { document, loadingError } = useEditableDocument(props.journals, props.documentId);

  if (loadingError) {
    return (
      <EditLoadingComponent setView={props.setView} error={loadingError} />
      )
  }


  if (!document) {
    return (
      <EditLoadingComponent setView={props.setView} />
    )
  }

  return <DocumentEditView document={document} journals={props.journals} setView={props.setView} />
}


interface DocumentEditProps {
  document: EditableDocument;
  journals: JournalResponse[];
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
}

const DocumentEditView = observer((props: DocumentEditProps) => {
  const {
    document,
    journals
  } = props;

  // Autofocus the heading input
  const onInputRendered = React.useCallback((inputElement: HTMLInputElement) => {
    if (inputElement) {
      // After experimenting, unsure why the delay is helpful.
      // https://blog.maisie.ink/react-ref-autofocus/
      setTimeout(() => inputElement.focus(), 200)
      inputElement.focus();
    }
  }, []);


  function getName(journalId?: string) {
    const journal = journals?.find(j => j.id === journalId)
    return journal ? journal.name : 'Unknown journal';
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
      )
    })
  }

  function makeMenu() {
    return (
      <Popover
        position={Position.BOTTOM}
        content={({close}) => (
          <div
            className={css`max-height: 400px; overflow: auto;`}
          >
          <Menu>
            <Menu.Group>
            {makeOptions(close)}
            </Menu.Group>
          </Menu>
          </div>
        )}
      >
        <span
      className={css`
        border-bottom: 1px dotted purple;
        color: purple;
        cursor: pointer;
      `}>
      {getName(document.journalId)}
    </span>
      </Popover>
    )
  }

  return (
    <Pane>
    <a onClick={() => props.setView('documents')}>Back</a>
    <Pane marginTop={24}>
      <div className={css`display: flex; justify-content: flex-start;`}>
        <div className={css`margin-right: 4px;`}>{document.createdAt.slice(0,10)}/</div>
        {makeMenu()}
      </div>
      <div className={css`
        margin-bottom: 16px;
        margin-top: 16px;
      `}>
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
          onChange={(e: any) => document.title = e.target.value}
          value={document.title}
          placeholder="Untitled"
          disabled={document.saving}
        />
      </div>
      
      {/* note: its not actually clear to me whether toJS is necessary here. */}
      <Editor saving={document.saving} value={toJS(document.slateContent)} setValue={document.setSlateContent} />

      <Pane marginTop={24}>
        <Button onClick={() => document.save()} disabled={!document.dirty} isLoading={document.saving}>Save</Button>
      </Pane>
    </Pane>
  </Pane>
  )
})

export default observer(JournalsLoadingContainer)