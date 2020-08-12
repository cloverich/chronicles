import React from "react";
import { Pane, Badge, Button, Heading } from "evergreen-ui";
import { useDocument } from "../hooks/documents";
import { observer } from "mobx-react-lite";
import remark from "remark";
const html = require("remark-html");

interface Props {
  journal: string;
  date: string;
  setEditing: (args: { journal: string; date: string }) => any;
}

const compiler = remark().use(html);

export default React.memo(
  observer(function Document(props: Props) {
    const docRecord = useDocument(props.journal, props.date);
    const { loading, error, data: document } = docRecord;

    let HTML: any;
    if (document) {
      HTML = compiler.stringify(document.mdast);
    }

    // todo: wrap this up in a display content
    if (loading) return <h1>Loading</h1>;
    if (error) return <h1>ERROR!</h1>;
    if (!HTML) return <h1>Missing HTML? It should be here...</h1>;
    return (
      <article style={{ marginTop: 64 }}>
        <Header {...props} />
        <div
          className="content-section"
          dangerouslySetInnerHTML={{ __html: HTML }}
        />
      </article>
    );
  })
);

interface HeaderProps {
  date: string;
  journal: string;
  setEditing: (args: { journal: string; date: string }) => any;
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
            props.setEditing({ journal: props.journal, date: props.date })
          }
          appearance="minimal"
        >
          Edit
        </Button>
      </Heading>
    </Pane>
  );
}
