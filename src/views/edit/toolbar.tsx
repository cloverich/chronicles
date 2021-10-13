import React from "react";
import {
  HeadingToolbar,
  ToolbarList,
  ToolbarMark,
  useStoreEditorRef,
  useEventEditorId,
  getPlatePluginType,
  ELEMENT_UL,
  ELEMENT_OL,
  MARK_BOLD,
  MARK_ITALIC,
  MARK_UNDERLINE,
  MARK_STRIKETHROUGH,
  MARK_CODE,
} from "@udecode/plate";
import {
  ListIcon,
  NumberedListIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  CodeIcon,
} from "evergreen-ui";
// import { css } from "emotion";
/**
 * Buttons for formatting text in the document
 * todo: consider styled-component-icons or remix-icons -- there are more
 */
export default function FormattingToolbar() {
  const editor = useStoreEditorRef(useEventEditorId("focus"));

  return (
    <HeadingToolbar>
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<BoldIcon style={{ width: "0.8rem", height: "0.8rem" }} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<ItalicIcon style={{ width: "0.8rem", height: "0.8rem" }} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_UNDERLINE)}
        icon={<UnderlineIcon style={{ width: "0.8rem", height: "0.8rem" }} />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_STRIKETHROUGH)}
        icon={
          <StrikethroughIcon style={{ width: "0.8rem", height: "0.8rem" }} />
        }
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_CODE)}
        icon={<CodeIcon style={{ width: "0.8rem", height: "0.8rem" }} />}
      />
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_UL)}
        icon={<ListIcon style={{ width: "0.8rem", height: "0.8rem" }} />}
      />
      <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_OL)}
        icon={
          <NumberedListIcon style={{ width: "0.8rem", height: "0.8rem" }} />
        }
      />
    </HeadingToolbar>
  );
}
