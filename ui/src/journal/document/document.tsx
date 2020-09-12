import React from "react";
import { useDocument } from "../../hooks/documents";
import { toJS } from "mobx";
import { observer } from "mobx-react-lite";
import remark from "remark";
import { Header } from "./header";
const html = require("remark-html");
import remark2Rehype from "remark-rehype";
import rehype2React from "rehype-react";
import { filtermdast, annotateHeadings } from "./filtermdast";
import { CustomDetailevent } from "../useViewModel";

interface Props {
  journal: string;
  date: string;

  store: {
    editing?: { journal: string; date?: string };
    filter?: CustomDetailevent["detail"];
  };
}

interface HeadingProps {
  children?: any;
  node?: {
    children: any; // hast node, I think
    position: any; // { start: { line, column, offset}, end: {...} }
    tagName: string; // h1
    type: string; // element
    properties: Record<string, any>; // { remarkString: string }
  };
}

function Heading(props: HeadingProps) {
  const handler = (evt: React.MouseEvent<HTMLHeadingElement>) => {
    evt.target.dispatchEvent(
      new CustomEvent("focus-heading", {
        bubbles: true,
        detail: {
          depth: props.node!.tagName,
          content: props.node!.properties.remarkString,
        },
      })
    );
  };

  switch (props.node!.tagName) {
    case "h1":
      return <h1 onClick={handler}>{props.children}</h1>;
    case "h2":
      return <h2 onClick={handler}>{props.children}</h2>;
    case "h3":
      return <h3 onClick={handler}>{props.children}</h3>;
    case "h4":
      return <h4 onClick={handler}>{props.children}</h4>;
    case "h5":
      return <h5 onClick={handler}>{props.children}</h5>;
    case "h6":
      return <h6 onClick={handler}>{props.children}</h6>;
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

function Document(props: Props) {
  const docRecord = useDocument(props.journal, props.date);
  const { loading, error, data: document } = docRecord;
  const store = props.store;

  let rendered: any;

  if (loading) return <h1>Loading</h1>;
  if (error) return <h1>ERROR!</h1>;
  if (!document) return <h1>Content not found :(</h1>;

  // Its always good to un-mobx something before passing off to a 3rd party library
  // However here, if you do not, some kind of mobx array out of bounds issue happens
  const mdast = toJS(document.mdast);

  // Walks the tree and adds metadata to heading nodes, so its available in the HAST tree
  annotateHeadings(mdast);

  // Compile entire tree, or only tree under a pinned heading
  const output = store.filter
    ? compiler.runSync(filtermdast(mdast, toJS(store.filter)))
    : compiler.runSync(mdast);

  // Creates React components
  rendered = compiler.stringify(output);

  if (!rendered) return <h1>Missing rendered? It should be here...</h1>;

  return (
    <article style={{ marginTop: 64 }}>
      <Header
        date={props.date}
        journal={props.journal}
        setEditing={(args) => (store.editing = args)}
      />
      {rendered}
    </article>
  );
}

// todo: Is React.memo necessary?
export default React.memo(observer(Document));
