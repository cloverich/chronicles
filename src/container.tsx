import { observer } from "mobx-react-lite";
import React from "react";
import "react-day-picker/dist/style.css";
import { Navigate, Route, Routes } from "react-router-dom";
import { Alert } from "./components";
import ErrorBoundary from "./error";
import { ApplicationContext, useAppLoader } from "./hooks/useApplicationLoader";
import Titlebar from "./titlebar/macos";
import { StyleWatcher } from "./views/StyleWatcher";
import { ThemeWatcher } from "./views/ThemeWatcher";
import DocumentCreator from "./views/create";
import Documents from "./views/documents";
import { SearchProvider } from "./views/documents/SearchProvider";
import Editor from "./views/edit";
import * as Base from "./views/layout";
import Preferences from "./views/preferences";

export default observer(function Container() {
  const { loading, loadingErr, applicationStore } = useAppLoader();

  // react-hook-hotkeys is a transitive dependency, but cmd+comma is not obviously
  // supported, and package on its way out. Once patched can use hotkeys here.
  // https://github.com/JohannesKlauss/react-hotkeys-hook/issues/1123
  // https://github.com/JohannesKlauss/react-hotkeys-hook/issues/1213
  React.useEffect(() => {
    if (!applicationStore) return;

    const handleKeydown = (event: any) => {
      if (applicationStore.isPreferencesOpen) return;

      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        applicationStore.togglePreferences(true);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [applicationStore]);

  if (loading) {
    return (
      <LayoutDummy>
        <h1>Loading...</h1>
      </LayoutDummy>
    );
  }

  // todo: This loading error is ugly, and not very helpful.
  if (loadingErr || !applicationStore) {
    return (
      <LayoutDummy>
        <Alert.Alert
          variant="error"
          title="Journals failed to load"
          className="overflow-x-auto"
        >
          <p>Journals failed to load: </p>
          <pre>${JSON.stringify(loadingErr, null, 2)}</pre>
        </Alert.Alert>
      </LayoutDummy>
    );
  }

  // note: store as ApplicationState assumes everything is loaded, and the rest of the
  // app relies on this being true.
  return (
    <ApplicationContext.Provider value={applicationStore}>
      <ThemeWatcher preferences={applicationStore.preferences} />
      <StyleWatcher preferences={applicationStore.preferences} />
      <Layout>
        <Preferences
          isOpen={applicationStore.isPreferencesOpen}
          onClose={() => applicationStore.togglePreferences(false)}
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

function LayoutDummy({ children }: any) {
  return (
    <ErrorBoundary>
      <Base.Container>
        <Titlebar className="pr-16"></Titlebar>
        <Base.TitlebarSpacer />
        <Base.ScrollContainer>{children}</Base.ScrollContainer>
      </Base.Container>
    </ErrorBoundary>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen min-w-[480px] flex-col bg-background text-foreground">
        {children}
      </div>
    </ErrorBoundary>
  );
}
