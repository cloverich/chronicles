import React, { useCallback } from "react";
import { Button } from "evergreen-ui";
import { toJS } from "mobx";
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
      <>
        <h1>todo: empty state for header</h1>
        <Button disabled={true}>Add</Button>
      </>
    );
  }

  return (
    <>
      <Dropdown
        journals={state.journals.map((j) => j.name)}
        selected={selectedJournal}
        onSelect={selectJournal}
      />
      <Button onClick={setEditing}>Add</Button>
    </>
  );
}

export default observer(Header);
