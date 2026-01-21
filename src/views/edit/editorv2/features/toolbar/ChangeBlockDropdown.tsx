import React from "react";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";

import type { TElement } from "platejs";
import { useEditorRef, useEditorSelector } from "platejs/react";
import { Editor, Element, Range, Transforms } from "slate";

import {
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_UL,
} from "../../../plate-types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  OpenState,
  useOpenState,
} from "../../../../../components/DropdownMenu";
import { Icons } from "../../../../../components/icons";
import { ToolbarButton } from "../../components/Toolbar";

const items = [
  {
    description: "Paragraph",
    icon: Icons.paragraph,
    label: "Paragraph",
    value: ELEMENT_PARAGRAPH,
  },
  {
    description: "Heading 1",
    icon: Icons.h1,
    label: "Heading 1",
    value: ELEMENT_H1,
  },
  {
    description: "Heading 2",
    icon: Icons.h2,
    label: "Heading 2",
    value: ELEMENT_H2,
  },
  {
    description: "Heading 3",
    icon: Icons.h3,
    label: "Heading 3",
    value: ELEMENT_H3,
  },
  {
    description: "Quote (⌘+⇧+.)",
    icon: Icons.blockquote,
    label: "Quote",
    value: ELEMENT_BLOCKQUOTE,
  },
  {
    description: "Code (```)",
    icon: Icons.codeblock,
    label: "Code",
    value: ELEMENT_CODE_BLOCK,
  },
  {
    description: "Bulleted list",
    icon: Icons.ul,
    label: "Bulleted list",
    value: ELEMENT_UL,
  },
  {
    description: "Numbered list",
    icon: Icons.ol,
    label: "Numbered list",
    value: ELEMENT_OL,
  },
];

const defaultItem = items.find((item) => item.value === ELEMENT_PARAGRAPH)!;

/**
 * Toolbar dropdown for toggling block types, e.g. paragraph, heading, blockquote.
 */
export const ChangeBlockDropdown = (props: DropdownMenuProps) => {
  const value: string = useEditorSelector((editor) => {
    try {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        // Validate selection paths exist before accessing them
        if (!Editor.hasPath(editor as any, selection.anchor.path)) {
          return ELEMENT_PARAGRAPH;
        }

        const [entry] = Array.from(
          // todo: Plate's BaseEditor is type-incompatible with Slate's Editor?
          Editor.nodes(editor as any, {
            match: (n) =>
              Element.isElement(n) && Editor.isBlock(editor as any, n),
          }),
        );

        if (entry) {
          const [node] = entry;
          return (
            items.find((item) => item.value === (node as TElement).type)
              ?.value ?? ELEMENT_PARAGRAPH
          );
        }
      }

      return ELEMENT_PARAGRAPH;
    } catch {
      // Selection may be stale after document changes, return default
      // rather than crashing the editor.
      return ELEMENT_PARAGRAPH;
    }
  }, []);

  const onChangeBlockType = (type: string) => {
    Transforms.setNodes(editor as any, { type } as any, {
      match: (n: any) =>
        Element.isElement(n) && Editor.isBlock(editor as any, n),
    });

    if (editor.selection) {
      Transforms.collapse(editor as any, { edge: "end" });
    }
    editor.tf.focus();
  };

  const editor = useEditorRef();
  const openState = useOpenState();

  return (
    <DropdownMenu modal={false} {...openState} {...props}>
      <MenuToggle value={value} openState={openState} />
      <MenuContent value={value} onChangeBlockType={onChangeBlockType} />
    </DropdownMenu>
  );
};

const MenuToggle = React.memo(
  ({ value, openState }: { value: string; openState: OpenState }) => {
    const selectedItem =
      items.find((item) => item.value === value) ?? defaultItem;
    const { icon: SelectedItemIcon, label: selectedItemLabel } = selectedItem;

    return (
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          isDropdown
          pressed={openState.open}
          tooltip="Change type"
        >
          <SelectedItemIcon size={16} />
        </ToolbarButton>
      </DropdownMenuTrigger>
    );
  },
);

const MenuContent = React.memo(
  ({
    value,
    onChangeBlockType,
  }: {
    value: string;
    onChangeBlockType: (type: string) => void;
  }) => {
    return (
      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuLabel>Turn into</DropdownMenuLabel>

        <DropdownMenuRadioGroup
          className="flex flex-col gap-0.5"
          onValueChange={(type) => onChangeBlockType(type)}
          value={value}
        >
          {items.map(({ icon: Icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem
              className="min-w-[180px]"
              key={itemValue}
              value={itemValue}
            >
              <Icon className="mr-2" size={16} />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    );
  },
);
