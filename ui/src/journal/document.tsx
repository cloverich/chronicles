import React, { useState, useEffect } from "react";
import { Pane } from "evergreen-ui";
import { useDocument } from "../hooks";
import remark from "remark";
const html = require("remark-html");

interface Props {
  journal: string;
  date: string;
}

const compiler = remark().use(html);

export default function Document(props: Props) {
  const { loading, error, document } = useDocument(props.journal, props.date);
  const [HTML, setHTML] = useState<string | null>(null);

  useEffect(() => {
    if (document) {
      setHTML(compiler.stringify(document.mdast));
    }
  }, [document]);

  function Content() {
    if (loading) return <h1>Loading</h1>;
    if (error) return <h1>ERROR!</h1>;
    if (!HTML) return <h1>Missing HTML? It should be here...</h1>;
    return <div dangerouslySetInnerHTML={{ __html: HTML }} />;
  }

  return (
    <Pane>
      <h5>
        {props.date} ({props.journal})
      </h5>
      <Content />
    </Pane>
  );
}
