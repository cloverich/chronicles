import React from "react";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";

import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_OL,
  ELEMENT_PARAGRAPH,
  ELEMENT_UL,
} from "@udecode/plate";
import { ELEMENT_BLOCKQUOTE } from "@udecode/plate-block-quote";
import {
  collapseSelection,
  findNode,
  focusEditor,
  isBlock,
  isCollapsed,
  toggleNodeType,
  useEditorRef,
  useEditorSelector,
  type TElement,
} from "@udecode/plate-common";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
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
 *
 * Referred to as "Turn into" dropdown in Plate UI docs.
 * https://platejs.org/docs/components/turn-into-dropdown-menu
 */
export default function ChangeBlockDropdown(props: DropdownMenuProps) {
  const value: string = useEditorSelector((editor) => {
    if (isCollapsed(editor.selection)) {
      const entry = findNode<TElement>(editor, {
        match: (n) => isBlock(editor, n),
      });

      if (entry) {
        return (
          items.find((item) => item.value === entry[0].type)?.value ??
          ELEMENT_PARAGRAPH
        );
      }
    }

    return ELEMENT_PARAGRAPH;
  }, []);

  const editor = useEditorRef();
  const openState = useOpenState();

  const selectedItem =
    items.find((item) => item.value === value) ?? defaultItem;
  const { icon: SelectedItemIcon, label: selectedItemLabel } = selectedItem;

  return (
    <DropdownMenu modal={false} {...openState} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="lg:min-w-[130px]"
          isDropdown
          pressed={openState.open}
          tooltip="Change type"
        >
          <SelectedItemIcon size={16} />
          <span className="max-lg:hidden">{selectedItemLabel}</span>
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuLabel>Turn into</DropdownMenuLabel>

        <DropdownMenuRadioGroup
          className="flex flex-col gap-0.5"
          onValueChange={(type) => {
            // if (type === 'ul' || type === 'ol') {
            //   if (settingsStore.get.checkedId(KEY_LIST_STYLE_TYPE)) {
            //     toggleIndentList(editor, {
            //       listStyleType: type === 'ul' ? 'disc' : 'decimal',
            //     });
            //   } else if (settingsStore.get.checkedId('list')) {
            //     toggleList(editor, { type });
            //   }
            // } else {
            //   unwrapList(editor);
            toggleNodeType(editor, { activeType: type });
            // }

            collapseSelection(editor);
            focusEditor(editor);
          }}
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
    </DropdownMenu>
  );
}
