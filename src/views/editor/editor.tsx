import Prism from "prismjs";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Slate, Editable, withReact, ReactEditor, RenderElementProps, useSlate } from "slate-react";
import { Text, createEditor, Node, Element as SlateElement, Editor, Selection } from "slate";
import { withHistory } from "slate-history";
import { css } from "emotion";
import { withImages } from './withImages';
import { isImageElement, isLinkElement, ImageElement, LinkElement } from './util';
import { Link } from './blocks/links';
import { HoveringToolbar, insertLink, removeLink } from './blocks/links';
import { TextInput, IconButton, Pane, TextInputField, Button } from 'evergreen-ui'

Prism.languages.markdown = Prism.languages.extend("markup", {});
(Prism.languages as any).insertBefore("markdown", "prolog", {
  blockquote: { pattern: /^>(?:[\t ]*>)*/m, alias: "punctuation" },
  code: [
    { pattern: /^(?: {4}|\t).+/m, alias: "keyword" },
    { pattern: /``.+?``|`[^`\n]+`/, alias: "keyword" },
  ],
  title: [
    {
      pattern: /\w+.*(?:\r?\n|\r)(?:==+|--+)/,
      alias: "important",
      inside: { punctuation: /==+$|--+$/ },
    },
    {
      pattern: /(^\s*)#+.+/m,
      lookbehind: !0,
      alias: "important",
      inside: { punctuation: /^#+|#+$/ },
    },
  ],
  hr: {
    pattern: /(^\s*)([*-])([\t ]*\2){2,}(?=\s*$)/m,
    lookbehind: !0,
    alias: "punctuation",
  },
  list: {
    pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
    lookbehind: !0,
    alias: "punctuation",
  },
  "url-reference": {
    pattern:
      /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
    inside: {
      variable: { pattern: /^(!?\[)[^\]]+/, lookbehind: !0 },
      string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
      punctuation: /^[\[\]!:]|[<>]/,
    },
    alias: "url",
  },
  bold: {
    pattern: /(^|[^\\])(\*\*|__)(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
    lookbehind: !0,
    inside: { punctuation: /^\*\*|^__|\*\*$|__$/ },
  },
  italic: {
    pattern: /(^|[^\\])([*_])(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
    lookbehind: !0,
    inside: { punctuation: /^[*_]|[*_]$/ },
  },
  url: {
    pattern:
      /!?\[[^\]]+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)| ?\[[^\]\n]*\])/,
    inside: {
      variable: { pattern: /(!?\[)[^\]]+(?=\]$)/, lookbehind: !0 },
      string: { pattern: /"(?:\\.|[^"\\])*"(?=\)$)/ },
    },
  },
});
(Prism.languages.markdown.bold as any).inside.url = Prism.util.clone(
  Prism.languages.markdown.url,
);
(Prism.languages.markdown.italic as any).inside.url = Prism.util.clone(
  Prism.languages.markdown.url,
);
(Prism.languages.markdown.bold as any).inside.italic = Prism.util.clone(
  Prism.languages.markdown.italic,
);
(Prism.languages.markdown.italic as any).inside.bold = Prism.util.clone(
  Prism.languages.markdown.bold,
);

export interface Props {
  saving: boolean;
  value: Node[];
  setValue: (n: Node[]) => any;
}


const renderElement = (props: RenderElementProps) => {
  const { attributes, children, element } = props

  // NOTE: This is being called constantly as text is selected, eww
  // todo: I could use !isTypedElement, return early, then use a switch with
  // type discrimination here to avoid the need for these type checking
  if (isImageElement(element)) {
    return <Image {...props} element={element} />
  } else if (isLinkElement(element)) { 
    return <Link {...props} element={element}>{children}</Link>
  } else {
    return <p {...attributes}>{children}</p>
  }
}

interface ImageElementProps extends RenderElementProps {
  element: ImageElement;
}


const Image = ({ attributes, children, element }: ImageElementProps) => {
  // Used in the example to conditionally set a drop shadow when image is hovered. 
  // const selected = useSelected()
  // const focused = useFocused()

  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <img
          src={element.url}
          className={css`
            display: block;
            max-width: 100%;
            max-height: 20em;
          `}
        />
      </div>
      {children}
    </div>
  )
}


const MarkdownPreviewExample = (props: Props) => {
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);

  // as ReactEditor fixes 
  // Argument of type 'BaseEditor' is not assignable to parameter of type 'ReactEditor'.
  // Real fix is probably here: https://docs.slatejs.org/concepts/12-typescript
  const editor = useMemo(() => withImages(withHistory(withReact(createEditor() as ReactEditor))), []);
  const decorate = useCallback(([node, path]) => {
    const ranges: any = [];

    if (!Text.isText(node)) {
      return ranges;
    }

    const getLength = (token: any) => {
      if (typeof token === "string") {
        return token.length;
      } else if (typeof token.content === "string") {
        return token.content.length;
      } else {
        return token.content.reduce((l: any, t: any) => l + getLength(t), 0);
      }
    };

    const tokens = Prism.tokenize(node.text, Prism.languages.markdown);
    let start = 0;

    for (const token of tokens) {
      const length = getLength(token);
      const end = start + length;

      if (typeof token !== "string") {
        ranges.push({
          [token.type]: true,
          anchor: { path, offset: start },
          focus: { path, offset: end },
        });
      }

      start = end;
    }

    return ranges;
  }, []);

  return (
    <Slate
      editor={editor}
      value={props.value}
      onChange={(value) => props.setValue(value)}
    >
      <HoveringToolbar />
      <EditLinkMenus />
      <Editable
        decorate={decorate}
        renderLeaf={renderLeaf}
        renderElement={renderElement}
        placeholder="Write some markdown..."
      />
    </Slate>
  );
};

// function getSelected() {
//   return const [link] = Editor.nodes(editor, {
//     match: n =>
//       !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
//   })
// }

// function getSelectedLinks() {
//   const [link] = Editor.nodes(editor, {
//     match: n =>
//       !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'link',
//   })

//   return link;
// }

function printNodes(nodes: any) {
  let results = [];

  for (const node of nodes) {
    results.push(node);
  }

  JSON.stringify(results, null, 2);
}

function EditLinkMenus() {
  const [isEditing, setEditingState] = useState<boolean>(false);
  const [linkNode, setLinkNode] = useState<LinkElement | Selection | null>(null);
  const editor = useSlate();

  // url form value
  const [editUrl, setEditUrl] = useState<string>('')

  function setEditing(editing: boolean) {
    // When exiting edit mode, unset the url form value
    // Cancelling or Save completed
    if (!editing) {
      setEditUrl('');

      // Intent was to close menu, but the view state re-populates because I think the 
      // re-render pulls the prior selection out of editor.selection (even though there's no 
      // cursor in the UI)
      setLinkNode(null);
    } else {
      if (isLinkElement(linkNode)) {
        setEditUrl(linkNode.url);
      } else {
        // may need the current selection here...
        console.log(editor.selection);
      }
    }

    setEditingState(editing);

    // todo: I also think when editing ends... the _last_ editor selection should run through
    // the "watch selection" so e.g. the view does not still show an old link or something.
  }

  // conditionally nullify stored linkNode
  // I feel like React did this value checking for you ,but I got a loop
  // so shrug
  function setNull() {
    if (linkNode !== null) setLinkNode(null);
  }

  function save() {
    if (!linkNode) {
      console.error('save called but linkNode is null. Probably chris did not finish refactoring');
      return;
    }

    // Validate URL
    if (editUrl) {
      // todo: if editUrl is blank, but linkNode is not... should ac
      // create or replace a linkNode
      insertLink(editor, editUrl, linkNode)
    } else {
      if (isLinkElement(linkNode)) {
        removeLink(editor, linkNode);
      }
    }

    setEditing(false);
  }

  function cancel() {
    // cancel editing... 
    setEditing(false);
  }

  function remove() {
    if (!isLinkElement(linkNode)) return;

    // unwrap link node
    removeLink(editor, linkNode)
  }

  useEffect(() => {
    // If already editing, stop tracking changes to what's selected
    // and rely on the existing cached selection to be updated after editing is
    // completed
    if (isEditing) return;

    // track the selected text so we know if a link is focused
    if (editor.selection) {
      console.log('editor.selection', editor.selection);
      const [node] = Editor.node(editor, editor.selection);


      // calling Editor.parent on root (editor) node throws an exception
      // This case also passes when I expand a selection beyond the URL in question however
      if (Editor.isEditor(node)) {
        console.log('node is root editor, bailing...')
        setNull();
        return;
      }

      const [parent] = Editor.parent(editor, editor.selection)
      if (isLinkElement(parent)) {
        console.log('isLinkElement', parent)
        // is it the same element as the one I stored previously?   
        if (linkNode !== parent) {
          console.log('updating linkNode to new parent', parent)
          
          // todo: unset selection
          setLinkNode(parent);
        }
      } else {
        console.log('setting linkNode to selection')
        // setNull();

        // todo: store selection
        setLinkNode(editor.selection)
      }
    } else {
      console.log('unsetting cached selection')

      // todo: clear selection
      setNull();
    }
  })

  return (
    <Pane display="flex" justifyContent="space-around">
      <Pane padding={16}>
        <p>Edit Link Form</p>
        <TextInputField
          label="URL"
          placeholder="Enter URL for the link"
          value={editUrl}
          onChange={(e: any) => setEditUrl(e.target.value)}
        />
        <Pane>
          <Button onClick={() => save()}>Save</Button>
          <Button marginLeft={8} onClick={() => cancel()}>Cancel</Button>
        </Pane>
      </Pane>
      <Pane padding={16}>
        <p>View Link Form</p>
        <p>
          <a href={isLinkElement(linkNode) && linkNode.url || ''}>{isLinkElement(linkNode) && linkNode.url || 'No Url'}</a>
        </p>
        <Pane>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button marginLeft={8} onClick={() => remove()}>Remove</Button>
        </Pane>

      </Pane>
    </Pane>
  )
}

function DisplaySelection() {
  const editor = useSlate();
  const [value, setValue] = useState('');
  
  // printNodes(Editor.nodes(editor, {
  //   match: n => !Editor.isEditor(n) && SlateElement.isElement(n),
  //   mode: 'all',
  // }))

  function getLinkUrl() {
    if (editor.selection && !Editor.isEditor(editor.selection)) {
      // console.log('edges', Editor.edges(editor, editor.selection))
      // console.log('end', Editor.end(editor, editor.selection))
      // console.log(Editor.node(editor, editor.selection))
      // console.log(Editor.parent(editor, editor.selection))
      
      console.log('selection', editor.selection);
      const [node] = Editor.node(editor, editor.selection);
      console.log('node', node);
      if (Editor.isEditor(node)) {
        console.log('doing a third way of trying to avoid passing parent to .parent which THROWS AN ERROR')
  
      } else if (editor.selection.focus.path[0] === 0 || editor.selection.anchor.path[0] === 0) {
        console.log('skipping parent check...')
      } else {
        const [parent] = Editor.parent(editor, editor.selection)
        // type: link
        // url: string
        console.log('parent', parent);
        if (isLinkElement(parent)) {
          return parent.url;
          // setValue(parent.url);
        }
  
      }
    }

    return '';
  }

  const url = getLinkUrl();
  if (value !== url) {
    // This is called when a URL is selected, but it ALSO is activated when
    // the URL is de-selected when the user focuses THIS FORM! ARGH! 
    console.log('setting. Value is:', value, 'URL is: ', url)
    setValue(url);
  } else {
    console.log('not setting...')
  }

  return (
    <div className={css`
      display: flex;
    `}>
      <div>
        <TextInput value={value} onChange={(e: any) => setValue(e.target.value)} />
      </div>
      <div>
        <IconButton icon="clean" />
        <IconButton icon="globe-network" />
        {/* <pre>{JSON.stringify(results, null, 2)} */}
  {/* </pre> */}
      </div>
        
    </div>
  )
}

const Leaf = ({ attributes, children, leaf }: any) => {
  return (
    <span
      {...attributes}
      className={css`
        font-weight: ${leaf.bold && "bold"};
        font-style: ${leaf.italic && "italic"};
        text-decoration: ${leaf.underlined && "underline"};
        ${leaf.title &&
        css`
            display: inline-block;
            font-weight: bold;
            font-size: 20px;
            margin: 20px 0 10px 0;
          `}
        ${leaf.list &&
        css`
            padding-left: 10px;
            font-size: 20px;
            line-height: 10px;
          `}
        ${leaf.hr &&
        css`
            display: block;
            text-align: center;
            border-bottom: 2px solid #ddd;
          `}
        ${leaf.blockquote &&
        css`
            display: inline-block;
            border-left: 2px solid #ddd;
            padding-left: 10px;
            color: #aaa;
            font-style: italic;
          `}
        ${leaf.code &&
        css`
            font-family: monospace;
            background-color: #eee;
            padding: 3px;
          `}
      `}
    >
      {children}
    </span>
  );
};

export default MarkdownPreviewExample;
