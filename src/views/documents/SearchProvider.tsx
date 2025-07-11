import React, { useEffect, useState } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import useClient from "../../hooks/useClient";
import { useJournals } from "../../hooks/useJournals";
import { SearchStore, SearchStoreContext } from "./SearchStore";

// Sets up document search and its context
export function SearchProvider() {
  const jstore = useJournals();
  const client = useClient();
  const [params, setParams] = useSearchParams();
  const [searchStore, setSearchStore] = useState<null | SearchStore>(null);

  // This is more like an effect. This smells. Maybe just roll this all up into
  // a hook.
  if (jstore && !searchStore) {
    const store = new SearchStore(
      client,
      jstore,
      setParams,
      params.getAll("search"),
    );
    store.search();
    setSearchStore(store);
  }

  // The identity of this function changes on every render
  // The store is not re-created, so needs updated.
  // This is a bit of a hack, but it works.
  useEffect(() => {
    if (searchStore) {
      searchStore.setTokensUrl = setParams;
    }
  }, [setParams]);

  if (!searchStore) {
    return <React.Fragment></React.Fragment>;
  }

  return (
    <React.Fragment>
      <SearchStoreContext.Provider value={searchStore}>
        <Outlet />
      </SearchStoreContext.Provider>
    </React.Fragment>
  );
}
