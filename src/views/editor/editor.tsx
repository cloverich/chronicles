import React, { useCallback, useMemo } from "react";
import { Slate, Editable, withReact, ReactEditor, RenderElementProps } from "slate-react";
import { createEditor, Node } from "slate";
import { withHistory } from "slate-history";
import { css } from "emotion";
import { withHelpers } from './withHelpers';
import { isImageElement, isLinkElement, ImageElement } from './util';
import { EditLinkMenus } from './blocks/links';
import { useDecorateMarkdown, MarkdownLeaf } from './blocks/markdown';

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
    return (
      <a {...attributes} href={element.url}>
        {children}
      </a>
    )
  } else {
    return <p {...attributes}>{children}</p>
  }
}

interface ImageElementProps extends RenderElementProps {
  element: ImageElement;
}


const Image = ({ attributes, children, element }: ImageElementProps) => {
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


/**
 * Slate editor with all the fixins
 */
const FancyPantsEditor = (props: Props) => {
  const renderLeaf = useCallback((props) => <MarkdownLeaf {...props} />, []);
  const decorateMarkdown = useDecorateMarkdown();

  // todo: `as ReactEditor` fixes 
  // Argument of type 'BaseEditor' is not assignable to parameter of type 'ReactEditor'.
  // Real fix is probably here: https://docs.slatejs.org/concepts/12-typescript
  const editor = useMemo(() => withHelpers(withHistory(withReact(createEditor() as ReactEditor))), []);

  return (
    <Slate
      editor={editor}
      value={props.value}
      onChange={(value) => props.setValue(value)}
    >
      <EditLinkMenus />
      <Editable
        decorate={decorateMarkdown}
        renderLeaf={renderLeaf}
        renderElement={renderElement}
        placeholder="Write some markdown... but don't get your hopes too high this is all proof of concept work!"
      />
    </Slate>
  );
};

export default FancyPantsEditor;
