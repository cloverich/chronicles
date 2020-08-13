import React, { useCallback } from "react";
import { Button, Pane, Heading } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import { useJournals } from "../hooks/journals";
import { Setter } from "../hooks/loadutils";
import Dropdown from "./search/singleselect";

interface EditingArgs {
  journal: string;
  date?: string;
}

interface Props {
  setEditing: (args?: EditingArgs) => any;
}

/**
 * Header wraps the search and create entry button....
 */
function Header(props: Props) {
  const state = useJournals();

  const selectJournal = (selected: string) => {
    state.query = {
      journals: [selected],
    };
  };

  // Here, dependendts depend on a journal being
  // This is handled in the parent container but is fragile...
  const selectedJournal = state.query.journals[0];

  const setEditing = useCallback(() => {
    props.setEditing({
      journal: state.journals[0].name,
    });
  }, [state.journals]);

  if (!state.journals.length) {
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
          journals={state.journals.map((j) => j.name)}
          selected={selectedJournal}
          onSelect={selectJournal}
        />
      </Pane>
      <Button onClick={setEditing}>Add</Button>
    </Pane>
  );
}

export default observer(Header);
