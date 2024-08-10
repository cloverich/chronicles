import React from "react";

import type { DropdownMenuProps } from "@radix-ui/react-dropdown-menu";

import { ELEMENT_BLOCKQUOTE } from "@udecode/plate-block-quote";
import {
  type TElement,
  collapseSelection,
  findNode,
  focusEditor,
  isBlock,
  isCollapsed,
  toggleNodeType,
  useEditorRef,
  useEditorSelector,
} from "@udecode/plate-common";
import {
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_PARAGRAPH,
} from "@udecode/plate";

import { Icons } from "../../../../../components/icons";

import {
  MoreIcon,
  HeaderOneIcon,
  HeaderTwoIcon,
  HeaderThreeIcon,
  CodeBlockIcon,
  CitationIcon,
  NumberedListIcon,
  PropertiesIcon,
  FontIcon,
  DeleteIcon,
  TrashIcon,
  ParagraphIcon,
} from "evergreen-ui";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  useOpenState,
} from "./DropdownMenu";
import { ToolbarButton } from "../../components/Toolbar";

const items = [
  {
    description: "Paragraph",
    icon: ParagraphIcon,
    label: "Paragraph",
    value: ELEMENT_PARAGRAPH,
  },
  {
    description: "Heading 1",
    icon: HeaderOneIcon,
    label: "Heading 1",
    value: ELEMENT_H1,
  },
  {
    description: "Heading 2",
    icon: HeaderTwoIcon,
    label: "Heading 2",
    value: ELEMENT_H2,
  },
  {
    description: "Heading 3",
    icon: HeaderThreeIcon,
    label: "Heading 3",
    value: ELEMENT_H3,
  },
  {
    description: "Quote (⌘+⇧+.)",
    icon: CitationIcon,
    label: "Quote",
    value: ELEMENT_BLOCKQUOTE,
  },
  {
    description: "Code (```)",
    icon: CodeBlockIcon,
    label: "Code",
    value: ELEMENT_CODE_BLOCK,
  },
  {
    description: "Bulleted list",
    icon: PropertiesIcon,
    label: "Bulleted list",
    value: "ul",
  },
  {
    description: "Numbered list",
    icon: NumberedListIcon,
    label: "Numbered list",
    value: "ol",
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
          <SelectedItemIcon className="size-5 lg:hidden" />
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
              <Icon className="mr-2 size-5" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
