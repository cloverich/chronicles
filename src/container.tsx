import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import Layout, { LayoutDummy } from "./layout";
import Preferences from "./views/preferences";
import Journals from "./views/journals";
import Documents from "./views/documents";
import Editor from "./views/edit";
import {
  useJournalsLoader,
  JournalsStoreContext,
} from "./hooks/useJournalsLoader";
import { Alert, Pane } from "evergreen-ui";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import useClient from "./hooks/useClient";
import {
  SearchV2Store,
  SearchStoreContext,
} from "./views/documents/SearchStore";

export default observer(function Container() {
  const { journalsStore, loading, loadingErr } = useJournalsLoader();
  const client = useClient();
  const [params, setParams] = useSearchParams();
  const [searchStore, setSearchStore] = useState<null | SearchV2Store>(null);

  // This is more like an effect. This smells. Maybe just roll this all up into
  // a hook.
  if (journalsStore && !loading && !searchStore) {
    const store = new SearchV2Store(
      client,
      journalsStore,
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

  if (loading || !searchStore) {
    return (
      <LayoutDummy>
        <h1>Loading Journals...</h1>
      </LayoutDummy>
    );
  }

  if (loadingErr) {
    return (
      <LayoutDummy>
        <Alert intent="danger" title="Journals failed to load">
          Journals failed to load: ${JSON.stringify(loadingErr)}
        </Alert>
      </LayoutDummy>
    );
  }

  return (
    <JournalsStoreContext.Provider value={journalsStore!}>
      <SearchStoreContext.Provider value={searchStore}>
        <Layout>
          <Routes>
            <Route element={<Journals />} path="journals" />
            <Route element={<Preferences />} path="preferences" />
            <Route element={<Editor />} path="edit/new" />
            <Route element={<Editor />} path="edit/:document" />
            <Route
              element={<Documents store={searchStore} />}
              path="documents"
            />
            <Route path="*" element={<Navigate to="documents" replace />} />
          </Routes>
        </Layout>
      </SearchStoreContext.Provider>
    </JournalsStoreContext.Provider>
  );
});
