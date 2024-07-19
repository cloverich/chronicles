import React, { useState, useEffect, useContext, Fragment } from "react";
import { observer } from "mobx-react-lite";
import Layout, { LayoutDummy } from "./layout";
import Preferences from "./views/preferences";
import Documents from "./views/documents";
import Editor from "./views/edit";
import DocumentCreator from "./views/create";
import { SearchProvider } from "./views/documents/SearchProvider";
import {
  useJournalsLoader,
  JournalsStoreContext,
} from "./hooks/useJournalsLoader";
import { Alert } from "evergreen-ui";
import { Routes, Route, Navigate } from "react-router-dom";
import "react-day-picker/dist/style.css";

export default observer(function Container() {
  const { journalsStore, loading, loadingErr } = useJournalsLoader();

  if (loading) {
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
