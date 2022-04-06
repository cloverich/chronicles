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
import { Routes, Route, Navigate } from 'react-router-dom';

export default observer(function Container() {
  const { journalsStore, loading, loadingErr } = useJournalsLoader();

  if (loading) {
    return (
      <LayoutDummy>
        <h1>TODO LOADING STATE</h1>
      </LayoutDummy>
    )
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
          <Route element={<Journals />} path="journals" />
          <Route element={<Preferences />} path="preferences" />
          <Route element={<Editor />} path="edit/new" />
          <Route element={<Editor />} path="edit/:document" />
          <Route element={<Documents />} path="documents" />
          <Route
            path="*"
            element={<Navigate to="documents" replace />}
          />
        </Routes>
      </Layout>
    </JournalsStoreContext.Provider>
  )
});
