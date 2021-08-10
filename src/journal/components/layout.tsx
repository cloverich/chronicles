import React, { PropsWithChildren as PC } from "react";
import { observer } from "mobx-react-lite";
import { Pane, Button } from "evergreen-ui";
import ModalEditor from "./editor/modal";
import Header from "./header";
import { IJournalsUiStore } from "../store";
import Sidebar from "./sidebar";

interface Props {
  store: IJournalsUiStore;
}

function JournalsLayout(props: PC<Props>) {
  const store = props.store;

  function onSaved(didSave: boolean) {
    props.store.editing = undefined;
  }

  return (
    <Pane margin={50}>
      <Sidebar store={props.store} />
      <Pane display={"flex"} marginBottom={25}>
        <Header store={store} />
        <Pane width={15} />
        <ModalEditor
          setEditing={(args) => (store.editing = args)}
          onSaved={onSaved}
          editing={store.editing}
        />
        <Pane width={15} />
      </Pane>
      {props.children}
    </Pane>
  );
}

export default observer(JournalsLayout);
