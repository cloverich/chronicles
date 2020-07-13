import React, { useState, PropsWithChildren } from "react";
import { Pane } from "evergreen-ui";
import { ContentState, JournalsState } from "../hooks";
import Document from "./document";
import ModalEditor, { Props as ModalEditorProps } from "./modal-editor";
import Search, { SearchProps } from "./search";

interface EditingArgs {
  journal: string;
  date?: string;
}

type LayoutProps = PropsWithChildren<SearchProps & ModalEditorProps>;

export default function JournalsLayout(
  props: LayoutProps,
) {
  return (
    <Pane margin={50}>
      <Pane display={"flex"} marginBottom={25}>
        <Search {...props} />
        <Pane width={15} />
        <ModalEditor
          {...props}
          editing={props.editing}
          setEditing={props.setEditing}
        />
      </Pane>
      {props.children}
    </Pane>
  );
}
