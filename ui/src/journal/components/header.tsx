import React from "react";
import { Button, Pane, Heading } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import Dropdown from "./search/singleselect";
import { IJournalsViewModel } from "../store";

interface EditingArgs {
  journal: string;
  date?: string;
}

interface Props {
  store: IJournalsViewModel;
}

/**
 * Header wraps the search and create entry button.
 */
function Header(props: Props) {
  const store = props.store;

  if (!store.hasJournals) {
    // really, should be handled above. But this provides some protection
    return (
      <Pane
        flex={1}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Heading level={2}>No journals</Heading>
        <Button disabled={true}>Add</Button>
      </Pane>
    );
  }

  return (
    <Pane
      flex={1}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      <Pane width={304}>
        <Dropdown
          journals={store.journals.map((j) => j.name)}
          selected={store.selectedJournal}
          onSelect={store.selectJournal}
        />
      </Pane>
      <Button onClick={store.editSelectedJournal}>Add</Button>
    </Pane>
  );
}

export default observer(Header);
