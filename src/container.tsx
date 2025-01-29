import { Alert } from "evergreen-ui";
import { observer } from "mobx-react-lite";
import React from "react";
import "react-day-picker/dist/style.css";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  ApplicationContext,
  ApplicationState,
  useAppLoader,
} from "./hooks/useApplicationLoader";
import Layout, { LayoutDummy } from "./layout";
import DocumentCreator from "./views/create";
import Documents from "./views/documents";
import { SearchProvider } from "./views/documents/SearchProvider";
import Editor from "./views/edit";
import Preferences from "./views/preferences";

export default observer(function Container() {
  const store = useAppLoader();

  // react-hook-hotkeys is a transitive dependency, but cmd+comma is not obviously
  // supported, and package on its way out. Once patched can use hotkeys here.
  // https://github.com/JohannesKlauss/react-hotkeys-hook/issues/1123
  // https://github.com/JohannesKlauss/react-hotkeys-hook/issues/1213
  React.useEffect(() => {
    const handleKeydown = (event: any) => {
      if (store.preferences.isOpen) return;

      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        store.preferences.toggle(true);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  if (store.loading) {
    return (
      <LayoutDummy>
        <h1>Loading...</h1>
      </LayoutDummy>
    );
  }

  // todo: This loading error is ugly, and not very helpful.
  if (store.loadingErr) {
    return (
      <LayoutDummy>
        <Alert intent="danger" title="Journals failed to load">
          Journals failed to load: ${JSON.stringify(store.loadingErr)}
        </Alert>
      </LayoutDummy>
    );
  }

  // note: store as ApplicationState assumes everything is loaded, and the rest of the
  // app relies on this being true.
  return (
    <ApplicationContext.Provider value={store as ApplicationState}>
      <Layout>
        <Preferences
          isOpen={store.preferences.isOpen}
          onClose={() => store.preferences.toggle(false)}
        />
        <Routes>
          <Route path="documents" element={<SearchProvider />}>
            <Route index element={<Documents />} />
            <Route path="edit/new" element={<DocumentCreator />} />
            <Route path="edit/:document" element={<Editor />} />
          </Route>
          <Route path="*" element={<Navigate to="documents" replace />} />
        </Routes>
      </Layout>
    </ApplicationContext.Provider>
  );
});
