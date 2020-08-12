import React, { PropsWithChildren as PC, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { Pane } from "evergreen-ui";
import ModalEditor from "./editor/modal";
import { useJournals } from "../hooks/journals";
import Header from "./header";
import { Setter } from "../hooks/loadutils";

interface EditingArgs {
  journal: string;
  date?: string;
}

interface Props {
  setEditing: (args?: EditingArgs) => any;
  editing: any; // que hueva
}

function JournalsLayout(props: PC<Props>) {
  const state = useJournals();

  const onSaved = useCallback(
    (didSave: boolean) => {
      // Unset editing state, which unmounts this component
      // Calling setEditing with undefined exists edit mode,
      // I can't get the type signature to accept undefined argh
      (props as any).setEditing();

      if (didSave) {
        // hacky way to refresh the query, todo: mobx
        state.query = { ...state.query };
      }
    },
    [props.setEditing]
  );

  return (
    <Pane margin={50}>
      <Pane display={"flex"} marginBottom={25}>
        <Header setEditing={props.setEditing} />
        <Pane width={15} />
        <ModalEditor
          setEditing={props.setEditing}
          onSaved={onSaved}
          editing={props.editing}
        />
      </Pane>
      {props.children}
    </Pane>
  );
}

export default observer(JournalsLayout);
