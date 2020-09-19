import React from "react";
import {
  Button,
  Pane,
  Heading,
  AddColumnRightIcon,
  ManuallyEnteredDataIcon,
} from "evergreen-ui";
import { observer } from "mobx-react-lite";
import TagSearch from "./search/tagsearch";
import { IJournalsUiStore } from "../store";

interface Props {
  store: IJournalsUiStore;
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
    <Pane flex={1} display="flex" alignItems="flex-end" flexDirection="column">
      <Pane display="flex" alignSelf="stretch" marginBottom={8}>
        <TagSearch store={store} />
      </Pane>
      <Pane>
        <Button
          height={24}
          marginRight={12}
          flexGrow={0}
          onClick={store.editSelectedJournal}
        >
          <ManuallyEnteredDataIcon />
        </Button>

        <Button height={24} onClick={() => (store.sidebarOpen = true)}>
          <AddColumnRightIcon />
        </Button>
      </Pane>
    </Pane>
  );
}

export default observer(Header);
