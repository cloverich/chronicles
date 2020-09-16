import React from "react";
import { useDocument } from "../../../hooks/documents";
import { toJS } from "mobx";
import { observer } from "mobx-react-lite";
import remark from "remark";
import { Header } from "./header";
import remark2Rehype from "remark-rehype";
import rehype2React from "rehype-react";
import { focusHeading, annotateHeadings } from "./mdast";
import { FocusHeadingEvent } from "../../useStore";

interface Props {
  journal: string;
  date: string;

  store: {
    editing?: { journal: string; date?: string };
    focusedHeading?: FocusHeadingEvent["detail"];
  };
}

interface HeadingProps {
  children?: any;
  node?: {
    children: any; // hast node, I think
    position: any; // { start: { line, column, offset}, end: {...} }
    tagName: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    type: string; // element
    properties: Record<string, any>; // { remarkString: string }
  };
}

const cursorStyle = { cursor: "pointer" };

/**
 * Customized heading component that adds a click event with the
 * raw markdown string, to facilitate searching by heading content.
 *
 * Relies on the annotateHeadings implementation. A bit hacky.
 * @param props
 */
function Heading(props: HeadingProps) {
  // See the `useViewModel` hook for how this is caught. Ugh.
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

  return React.createElement(
    props.node!.tagName, // 'h1', 'h2', etc
    { style: cursorStyle, onClick: handler },
    props.children
  );
}

// Converts markdown to react components.
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

/**
 * Renders a journal document's content and wrappig containers
 */
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

  // NOTE: The compiler.runSync and compiler.stringify calls work,
  // but I did not verify if this is the right / best way to do this

  // Compile entire tree, or only tree under a focused heading
  const output = store.focusedHeading
    ? compiler.runSync(focusHeading(mdast, toJS(store.focusedHeading)))
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
