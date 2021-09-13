import React from 'react';
import { observer } from 'mobx-react-lite';
import Editor from './editor';
import { Pane, Button, Alert, TextInputField } from 'evergreen-ui';
import { useEditableDocument } from './useEditableDocument';
import { useJournals } from '../../useJournals';
import { Node } from 'slate';
import { slateToMdast } from './util';

interface Props {
  documentId: string;
}

function EditDocument(props: Props) {
  const {
    setEditorValue,
    slateContent,
    save,
    isDirty,
    loading: loadingDoc,
    loadingErr: loadingDocErr,
    docState,
  } = useEditableDocument(props.documentId);

  const { journals, loading: loadingJournals, loadingErr: loadingJournalsErr } = useJournals()
  const loading = loadingDoc || loadingJournals
  const loadingErr = loadingDocErr || loadingJournalsErr
  const [showAST, setShowAST] = React.useState<boolean>(false);


  function renderError() {
    if (!loadingErr) return null;
    
    return (
      <Alert 
        intent="danger" 
        title="Error saving journal"
      >
        {JSON.stringify(loadingErr)}
      </Alert>
    )
  }

  function getName(journalId?: string) {
    const journal = journals?.find(j => j.id === journalId)
    return journal ? journal.name : 'Unknown journal';
  }

  function showASTOrEditor(showAST: boolean) {
    if (showAST) {
      return <ASTExplorer slateNodes={slateContent} />
    } else {
      return <Editor saving={docState?.saving || loading} value={slateContent} setValue={setEditorValue} />
    }
  }

  return (
    <Pane marginTop={24}>
      {renderError()}
      <TextInputField
        name="title"
        label="" // seems to require empty string to be null and hidden
        placeholder="An optional title for this document"
        disabled={docState?.saving || loading}
        onChange={(e: any) => docState!.title = e.target.value}
        value={docState && docState.title || ''}
        />
      <Button onClick={() => setShowAST(!showAST)}>Toggle AST</Button>
      <p style={{fontSize: '0.8rem', fontWeight: 'bold'}}>/{getName(docState?.journalId)}</p>

      {showASTOrEditor(showAST)}
      <Button onClick={save} disabled={!isDirty} isLoading={docState?.saving || loading}>Save</Button>
    </Pane>
  )
}

export default observer(EditDocument)




export interface ASTProps {
  slateNodes: Node[];
}

/**
 * Added to help me visualize the Slate DOM and how it converts to MDAST
 * 
 * @param p
 * @returns 
 */
const ASTExplorer = (p: ASTProps) => {
  return (
    <div style={{display: 'flex', flexBasis: 100, flex: 1}}>
      <pre style={{overflow: 'auto', border: '1px solid blue'}}>{JSON.stringify(p.slateNodes, null, 2)}</pre>
      <pre style={{overflow: 'auto', border: '1px solid blue'}}>{slateToMdast(p.slateNodes)}</pre>
    </div>
  )
}