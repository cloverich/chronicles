import React, { PropsWithChildren as PC, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { Pane } from "evergreen-ui";
import ModalEditor from "./editor/modal";
import { useJournals } from "../hooks/journals";
import Header from "./header";
import { Setter } from "../hooks/loadutils";
import { IJournalsViewModel } from "./useViewModel";

interface Props {
  store: IJournalsViewModel;
}

function JournalsLayout(props: PC<Props>) {
  const store = props.store;

  function onSaved(didSave: boolean) {
    props.store.editing = undefined;
  }

  return (
    <Pane margin={50}>
      <Pane display={"flex"} marginBottom={25}>
        <Header store={store} />
        <Pane width={15} />
        <ModalEditor
          setEditing={(args) => (store.editing = args)}
          onSaved={onSaved}
          editing={store.editing}
        />
      </Pane>
      {props.children}
    </Pane>
  );
}

export default observer(JournalsLayout);
