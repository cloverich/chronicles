import { Alert } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import "react-day-picker/dist/style.css";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  JournalsStoreContext,
  useAppLoader,
} from "./hooks/useApplicationLoader";
import Layout, { LayoutDummy } from "./layout";
import DocumentCreator from "./views/create";
import Documents from "./views/documents";
import { SearchProvider } from "./views/documents/SearchProvider";
import Editor from "./views/edit";
import Preferences from "./views/preferences";

export default observer(function Container() {
  const { journalsStore, loading, loadingErr } = useAppLoader();

  if (loading) {
    return (
      <LayoutDummy>
        <h1>Loading...</h1>
      </LayoutDummy>
    );
  }

  // todo: This loading error is ugly, and not very helpful. Why does it
  // happen? Is it only journal loading errors?
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
      <Layout>
        <Routes>
          <Route path="preferences" element={<Preferences />} />
          <Route path="documents" element={<SearchProvider />}>
            <Route index element={<Documents />} />
            <Route path="edit/new" element={<DocumentCreator />} />
            <Route path="edit/:document" element={<Editor />} />
          </Route>
          <Route path="*" element={<Navigate to="documents" replace />} />
        </Routes>
      </Layout>
    </JournalsStoreContext.Provider>
  );
});
