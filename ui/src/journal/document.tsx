import React from "react";
import { Pane } from "evergreen-ui";
import { useDocument } from "../hooks";

interface Props {
  journal: string;
  date: string;
}

export default function Document(props: Props) {
  const { loading, error, document } = useDocument(props.journal, props.date);
  function Content() {
    if (loading) return <h1>Loading</h1>;
    if (error) return <h1>ERROR!</h1>;
    return <pre>{JSON.stringify(document?.mdast, null, 2)}</pre>;
  }

  console.log(`render Document - ${props.date} - ${props.journal}`);
  return (
    <Pane>
      <Content />
    </Pane>
  );
}
