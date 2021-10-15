import React from "react";
import { observer } from "mobx-react-lite";
import { toggleList } from "@udecode/plate-list";
import {
  Plate,
  createReactPlugin,
  createHistoryPlugin,
  createParagraphPlugin,
  createBlockquotePlugin,
  createCodeBlockPlugin,
  createHeadingPlugin,
  createBoldPlugin,
  createItalicPlugin,
  createUnderlinePlugin,
  createStrikethroughPlugin,
  createCodePlugin,
  createPlateComponents,
  createPlateOptions,

  // images
  // createImagePlugin, // made my own
  createSelectOnBackspacePlugin,
  ELEMENT_IMAGE,

  // So document always has a trailing paragraph
  createTrailingBlockPlugin,
  ELEMENT_PARAGRAPH,

  // links
  createLinkPlugin,

  // list plugins
  createTodoListPlugin,
  createSoftBreakPlugin,
  createExitBreakPlugin,
  createResetNodePlugin,
  createListPlugin,
} from "@udecode/plate";
import { Node as SNode } from "slate";
import {
  optionsSoftBreakPlugin,
  optionsExitBreakPlugin,
  optionsResetBlockTypePlugin,
} from "./plugins/pluginOptions";

import { createImagePlugin } from "./plugins/createImagePlugin";

export interface Props {
  saving: boolean;
  value: SNode[];
  setValue: (n: SNode[]) => any;
}

export default observer((props: Props) => {
  const editableProps = {
    placeholder: "Type…",
    style: {
      padding: "15px",
    },
  };

  const plugins = [
    // editor
    createReactPlugin(), // withReact
    createHistoryPlugin(), // withHistory

    // elements
    createParagraphPlugin(), // paragraph element
    createBlockquotePlugin(), // blockquote element
    createCodeBlockPlugin(), // code block element
    createHeadingPlugin(), // heading elements

    // marks
    createBoldPlugin(), // bold mark
    createItalicPlugin(), // italic mark
    createUnderlinePlugin(), // underline mark
    createStrikethroughPlugin(), // strikethrough mark
    createCodePlugin(), // code mark

    createImagePlugin(),
    createSelectOnBackspacePlugin({ allow: [ELEMENT_IMAGE] }),

    createLinkPlugin(),

    // createTodoListPlugin(),
    createSoftBreakPlugin(optionsSoftBreakPlugin),
    createExitBreakPlugin(optionsExitBreakPlugin),
    createResetNodePlugin(optionsResetBlockTypePlugin),
    createListPlugin(),

    // This works, but my trailing image is wrapped in a p already!
    createTrailingBlockPlugin({ type: ELEMENT_PARAGRAPH }),
  ];
  const components = createPlateComponents();
  const options = createPlateOptions();

  return (
    <>
      <Plate
        editableProps={editableProps}
        initialValue={props.value}
        onChange={props.setValue}
        plugins={plugins}
        components={components}
        options={options}
      ></Plate>
    </>
  );
});
