import React from "react";
import {
  HeadingToolbar,
  ToolbarElement,
  ToolbarList,
  ToolbarMark,
  ToolbarCodeBlock,
  useStoreEditorRef,
  useEventEditorId,
  getPlatePluginType,
  ELEMENT_UL,
  ELEMENT_OL,
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  MARK_BOLD,
  MARK_ITALIC,
  MARK_UNDERLINE,
  MARK_STRIKETHROUGH,
  MARK_CODE,
} from "@udecode/plate";
import {
  HeaderOneIcon,
  HeaderTwoIcon,
  ListIcon,
  NumberedListIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
  CodeBlockIcon,
  Pane,
} from "evergreen-ui";
// import { css } from "emotion";

const iconStyle = { width: "0.8rem", height: "0.8rem" };

/**
 * Buttons for formatting text in the document
 * todo: consider styled-component-icons or remix-icons -- there are more
 */
export default function FormattingToolbar() {
  const editor = useStoreEditorRef(useEventEditorId("focus"));

  return (
    <Pane display="flex" alignItems="center">
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H1)}
        icon={<HeaderOneIcon style={iconStyle} />}
      />
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H2)}
        icon={<HeaderTwoIcon style={iconStyle} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<BoldIcon style={iconStyle} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<ItalicIcon style={iconStyle} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_UNDERLINE)}
        icon={<UnderlineIcon style={iconStyle} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_STRIKETHROUGH)}
        icon={<StrikethroughIcon style={iconStyle} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_CODE)}
        icon={<CodeIcon style={iconStyle} />}
      />
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_UL)}
        icon={<ListIcon style={iconStyle} />}
      />
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_OL)}
        icon={<NumberedListIcon style={iconStyle} />}
      />
      <ToolbarCodeBlock
        type={getPlatePluginType(editor, ELEMENT_CODE_BLOCK)}
        icon={<CodeBlockIcon style={iconStyle} />}
      />
    </Pane>
  );
}
