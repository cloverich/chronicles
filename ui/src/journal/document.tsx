import React, { useState, useEffect } from "react";
import { Pane, Badge, Button, Heading } from "evergreen-ui";
import { useDocument } from "../hooks";
import remark from "remark";
const html = require("remark-html");

interface Props {
  journal: string;
  date: string;
  setEditing: (args: { journal: string; date: string }) => any;
}

const compiler = remark().use(html);

export default React.memo(function Document(props: Props) {
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

  // todo: move deeper, into the display component
  // because it should re-run when document.raw changes but
  // not because of editing
  useEffect(() => {
    if (document) {
      setHTML(compiler.stringify(document.mdast));
    }
  }, [document]);

  // todo: wrap this up in a display content
  if (loading) return <h1>Loading</h1>;
  if (error) return <h1>ERROR!</h1>;
  if (!HTML) return <h1>Missing HTML? It should be here...</h1>;
  return (
    <article style={{ marginTop: 64 }}>
      <Header
        {...props}
        saveDocument={saveDocument}
      />
      <Pane>
        <div dangerouslySetInnerHTML={{ __html: HTML }} />
      </Pane>
    </article>
  );
});

interface HeaderProps {
  date: string;
  journal: string;
  setEditing: (args: { journal: string; date: string }) => any;
  saveDocument: any;
}

function Header(props: HeaderProps) {
  return (
    <Pane display="flex" flexDirection="column" width={400}>
      <Heading fontFamily="IBM Plex Mono">
        <Badge color="neutral" fontFamily="IBM Plex Mono">
          /{props.date}/{props.journal}
        </Badge>

        <Button
          fontFamily="IBM Plex Mono"
          onClick={() =>
            props.setEditing({ journal: props.journal, date: props.date })}
          appearance="minimal"
        >
          Edit
        </Button>
      </Heading>
    </Pane>
  );
}
