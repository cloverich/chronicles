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
  createImagePlugin,
  createSelectOnBackspacePlugin,
  ELEMENT_IMAGE,

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
} from "./pluginOptions";

export interface Props {
  saving: boolean;
  value: SNode[];
  setValue: (n: SNode[]) => any;
}

import {
  HeadingToolbar,
  ToolbarList,
  useStoreEditorRef,
  useEventEditorId,
  getPlatePluginType,
  ELEMENT_UL,
  ELEMENT_OL,
} from "@udecode/plate";
import { ListIcon, NumberedListIcon } from "evergreen-ui";

function ToolbarButtonsList({ editor }: { editor: any }) {
  const editor2 = useStoreEditorRef(useEventEditorId("focus"));
  console.log("editor2", editor2 === editor, editor2);

  return (
    <HeadingToolbar>
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_UL)}
        icon={<ListIcon />}
      />
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_OL)}
        icon={<NumberedListIcon />}
      />
      <ListIcon onClick={() => toggleList(editor, { type: ELEMENT_UL })} />
    </HeadingToolbar>
  );
}

export default observer((props: Props) => {
  const editableProps = {
    placeholder: "Type…",
    style: {
      padding: "15px",
    },
  };
  const editor = useStoreEditorRef(useEventEditorId("focus"));

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
  ];
  const components = createPlateComponents();
  const options = createPlateOptions();

  React.useEffect(() => {
    console.log("initialValue: ", props.value);
    console.log(editor);
  }, []);

  return (
    <>
      <Plate
        editableProps={editableProps}
        initialValue={props.value}
        onChange={(newValue: any) => {
          console.log("setValue", newValue);
          props.setValue(newValue);
        }}
        plugins={plugins}
        components={components}
        options={options}
      ></Plate>
    </>
  );
});
