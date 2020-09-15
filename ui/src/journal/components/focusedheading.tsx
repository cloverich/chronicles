import React from "react";
import remark from "remark";
import remark2Rehype from "remark-rehype";
import rehype2React from "rehype-react";
import { Button } from "evergreen-ui";

interface Props {
  node: any;
  children: any;
}

function Heading(props: Props) {
  // 0 margin-bottom makes the "clear" button below it snug,
  // see the parent component
  const style = { marginBottom: 0 };

  switch (props.node!.tagName) {
    case "h1":
      return <h1 style={style}>{props.children}</h1>;
    case "h2":
      return <h2 style={style}>{props.children}</h2>;
    case "h3":
      return <h3 style={style}>{props.children}</h3>;
    case "h4":
      return <h4 style={style}>{props.children}</h4>;
    case "h5":
      return <h5 style={style}>{props.children}</h5>;
    case "h6":
      return <h6 style={style}>{props.children}</h6>;
    default:
      console.error("Heading component received unknown node", props.node);
      return <h6>(error){props.children}</h6>;
  }
}

// https://github.com/rehypejs/rehype-react
const compiler = remark()
  .use(remark2Rehype)
  .use(rehype2React, {
    createElement: React.createElement,
    passNode: true,
    components: {
      h1: Heading as any,
      h2: Heading as any,
      h3: Heading as any,
      h4: Heading as any,
      h5: Heading as any,
      h6: Heading as any,
    },
  });

interface PHProps {
  clearHeading: any;
  content: string;
}

export default function FocusedHeading(props: PHProps) {
  // todo: combine lines into one: processSync?
  const parsed = compiler.parse(props.content);
  const out = compiler.stringify(compiler.runSync(parsed));

  return (
    <div>
      {out}
      <Button appearance="minimal" onClick={props.clearHeading}>
        clear
      </Button>
    </div>
  );
}
