import React from 'react';
import { observer } from 'mobx-react-lite';
import Editor from '../../journal/components/editor/editor';
import { Pane, Button, Alert, TextInputField } from 'evergreen-ui';
import { useEditableDocument } from './useEditableDocument';
import EditDocument from './EditDocument';
import CreateDocument from './CreateDocument';
import { ViewState } from '../../container';



interface Props extends React.PropsWithChildren<{}> {
  documentId?: string;
  // todo: use this to set the default journal on new documents
  journalId?: string;
  setView: React.Dispatch<React.SetStateAction<ViewState>>
}


function EditorContainer(props: Props) {
  if (props.documentId) {
    return (
      <Pane>
        <a onClick={() => props.setView('documents')}>Back</a>
        <EditDocument documentId={props.documentId} />
      </Pane>
    )
  } else {
    return (
      <Pane>
        <a onClick={() => props.setView('documents')}>Back</a>
        <CreateDocument />
      </Pane>
    )
  }
}

export default observer(EditorContainer)