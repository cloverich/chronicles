import React, { useState, useEffect } from "react";
import { Pane, Badge, Text, Button } from "evergreen-ui";
import { useDocument, DocumentState } from "../hooks";
import remark from "remark";
const html = require("remark-html");
import Editor from "./editor";
import { Node } from "slate";

interface Props {
  journal: string;
  date: string;
}

const compiler = remark().use(html);

export default function Document(props: Props) {
  const docState = useDocument(props.journal, props.date);
  const {
    loading,
    error,
    document,
    saveDocument,
    saving,
    saveError,
  } = docState;
  const [HTML, setHTML] = useState<string | null>(null);
  const [editing, setEdit] = useState(false);

  // display "done" instead of "edit" when editing
  // display save status... how? dirty means not saved..
  // saveDocument triggers save...
  // todo: Toast on error. Possible to monitor state transtions from state?
  // That's a cool concept I think.
  // Hmmm... not its an anti-pattern. Better to model the state outside the component,
  // where its always relevant, and only react to it in the component. Then the component
  // can remain declarative
  const status = saving ? "saving" : saveError ? "error" : "saved"; // error?
  const editText = editing ? "done" : "edit";

  function edit() {
    // this is naive. see hook for more comments
    setEdit(!editing);
  }

  // todo: move deeper, into the display component
  // because it should re-run when document.raw changes but
  // not because of editing
  useEffect(() => {
    if (document) {
      setHTML(compiler.stringify(document.mdast));
    }
  }, [document]);

  if (editing) {
    return (
      <EditorContainer
        journal={props.journal}
        date={props.date}
        status={status}
        editText={editText}
        toggleEdit={edit}
        editContent={document!.raw}
        {...docState}
      />
    );
  } else {
    // todo: wrap this up in a display content
    if (loading) return <h1>Loading</h1>;
    if (error) return <h1>ERROR!</h1>;
    if (!HTML) return <h1>Missing HTML? It should be here...</h1>;
    return (
      <Pane border="default" margin={25}>
        <Header
          {...props}
          status={status}
          editText={editText}
          toggleEdit={edit}
          saveDocument={saveDocument}
        />
        <Pane margin={25}>
          <div dangerouslySetInnerHTML={{ __html: HTML }} />
        </Pane>
      </Pane>
    );
  }
}

type ECProps = EditHeaderProps & DocumentState;

function EditorContainer(props: ECProps) {
  // document?.raw -> initialvalue
  // save -> value.map((n: any) => Node.string(n)).join("\n")
  //  // any b/c it complains on setValue is of type Node[]
  const [value, setValue] = useState<any>([
    { children: [{ text: props.document?.raw || "" }] },
  ]); // any b/c it complains on setValue is of type Node[]

  function saveDocument() {
    const s = value.map((n: any) => Node.string(n)).join("\n");
    props.saveDocument(value.map((n: any) => Node.string(n)).join("\n"));
  }

  return (
    <Pane border="default" margin={25}>
      <EditHeader {...props} saveDocument={saveDocument} />
      <Pane margin={25}>
        <Editor value={value} setValue={setValue} saving={props.saving} />
      </Pane>
    </Pane>
  );
}

interface HeaderProps {
  date: string;
  journal: string;
  status: string;
  editText: string;
  toggleEdit: any;
  saveDocument: any;
}

function Header(props: HeaderProps) {
  return (
    <>
      <Text>
        <Badge color="blue">{props.date} </Badge>
        <Badge color="blue">({props.journal})</Badge>
        <Badge color="blue">{props.status}</Badge>
      </Text>
      <Button onClick={props.toggleEdit} appearance="minimal">
        {props.editText}
      </Button>
    </>
  );
}

interface EditHeaderProps extends HeaderProps {
  saveDocument: any;
  editContent: string;
  saving: boolean;
}

function EditHeader(props: EditHeaderProps) {
  return (
    <>
      <Text>
        <Badge color="blue">{props.date} </Badge>
        <Badge color="blue">({props.journal})</Badge>
        <Badge color="blue">{props.status}</Badge>
      </Text>
      <Button onClick={props.toggleEdit} appearance="minimal">
        {props.editText}
      </Button>
      <Button
        disabled={props.saving}
        onClick={() => props.saveDocument(props.editContent)}
        appearance="minimal"
      >
        Save
      </Button>
    </>
  );
}
